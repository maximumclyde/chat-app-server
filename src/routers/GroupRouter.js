const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const { checkAuth } = require("../middleware");
const { Group, User, Message } = require("../models");
const { findWsUser } = require("../socket");

const GroupRouter = express.Router();
const upload = multer();

GroupRouter.get("/groups/:groupId", checkAuth, async (req, res) => {
  try {
    let { user } = req;
    let groupId = req.params.groupId;
    let group = await Group.findById(groupId);

    if (!group) {
      res.status(404).send("Could not find group");
      return;
    }

    if (
      !group.groupMembers.find((id) => id.toString() === user._id.toString())
    ) {
      res.status(403).send("Cannot get info on a group you are not a part of");
      return;
    }

    res.status(200).send(group);
  } catch (err) {
    res.status(500).send(err);
  }
});

GroupRouter.post(
  "/groups/:groupId/avatar",
  checkAuth,
  upload.single("avatar"),
  async (req, res) => {
    const { user, file } = req;
    const { groupId } = req.params;
    try {
      let group = await Group.findById(groupId);
      if (!group) {
        res.status(404).send("Group not found");
        return;
      }

      if (
        !group?.groupMembers?.find((e) => e.toString() === user._id.toString())
      ) {
        res
          .status(403)
          .send("Cannot make changes if you are not part of the group");
        return;
      }

      if (
        !group?.groupAdmins?.find((e) => e.toString() === user._id.toString())
      ) {
        res.status(403).send("Cannot make changes if you are not an admin");
        return;
      }

      group.avatar = file.buffer;
      await group.save();

      const userId = user._id.toString();
      for (const member of group.groupMembers) {
        const id = member.toString();

        if (id === userId) {
          continue;
        }

        const wsClient = findWsUser(id);
        if (wsClient) {
          wsClient.send(
            JSON.stringify({
              request: "group-avatar-change",
              body: {
                groupId,
                avatar: group.avatar,
                userId: user._id.toString(),
                userName: user.userName,
              },
            })
          );
        }
      }

      res.status(200).send(group);
    } catch (err) {
      res.status(500).send(err);
    }
  }
);

GroupRouter.post("/groups", checkAuth, async (req, res) => {
  try {
    let { user } = req;
    const { groupName, groupMembers = [] } = req.body;

    const membersIdList = [
      user._id,
      ...groupMembers.map((id) => new mongoose.Types.ObjectId(id)),
    ];

    let group = new Group({
      groupName,
      groupMembers: membersIdList,
      groupAdmins: [user._id],
      createdBy: {
        name: user.userName,
        id: user._id,
      },
    });

    group = await group.save();

    await User.updateMany(
      { _id: { $in: membersIdList } },
      {
        $push: {
          groupList: group._id,
        },
      }
    ).then(() => {
      const userId = user._id.toString();

      for (const member of membersIdList) {
        const id = member.toString();
        if (id === userId) {
          continue;
        }

        const wsClient = findWsUser(id);
        if (wsClient) {
          wsClient.send(
            JSON.stringify({
              request: "group-create",
              body: {
                groupId: group._id.toString(),
                userId: user._id.toString(),
                userName: user.userName,
                groupName: group.groupName,
              },
            })
          );
        }
      }
    });

    res.status(200).send(group);
  } catch (err) {
    res.status(500).status(err);
  }
});

GroupRouter.delete("/groups/:groupId", checkAuth, async (req, res) => {
  const { user } = req;
  const { groupId } = req.params;

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      res.status(404).send("The group was not found");
      return;
    }

    if (
      !group.groupAdmins.find((id) => id.toString() === user._id.toString())
    ) {
      res.status(403).send("Cannot operate if user is not admin");
      return;
    }

    await Promise.all([
      User.updateMany(
        {
          $or: [
            { groupList: { $elemMatch: { $eq: group._id } } },
            { groupBlock: { $elemMatch: { $eq: group._id } } },
          ],
        },
        {
          $pull: {
            groupList: {
              $elemMatch: { $eq: group._id },
            },
            groupBlock: {
              $elemMatch: { $eq: group._id },
            },
          },
        }
      ),
      Message.deleteMany({ groupId: group._id }),
      Group.deleteOne({ _id: group._id }),
    ]).then(() => {
      const userId = user._id.toString();

      for (const member of group.groupMembers) {
        const memberId = member.toString();
        const wsClient = findWsUser(memberId);

        if (wsClient) {
          wsClient.send(
            JSON.stringify({
              request: "group-delete",
              body: {
                groupId: group._id.toString(),
                groupName: group.groupName,
                userId,
                userName: user.userName,
              },
            })
          );
        }
      }
    });

    res.status(200).send();
  } catch (err) {
    res.status(500).send(err);
  }
});

GroupRouter.post(
  "/groups/:groupId/addUser/:id",
  checkAuth,
  async (req, res) => {
    try {
      let { user } = req;
      const groupId = req.params.groupId;
      const userIdToAdd = req.params.id;
      const userId = user._id.toString();

      let group = await Group.findById(groupId);
      if (!group) {
        res.status(404).send("Could not find group");
        return;
      }

      if (!group.groupAdmins.find((id) => id.toString() === userId)) {
        res.status(403).send("Cannot operate if user is not admin");
        return;
      }

      if (group.groupMembers.find((id) => id.toString() === userIdToAdd)) {
        res.status(403).send("Cannot add the same member twice");
        return;
      }

      if (!user.friendList.find((id) => id.toString() === userIdToAdd)) {
        res
          .status(403)
          .send("Cannot add a user that's not in your friend list");
        return;
      }

      let requestUser = await User.findById(userIdToAdd);
      if (!requestUser) {
        res.status(404).send("Could not find user");
        return;
      }

      if (requestUser.groupBlock.find((id) => id.toString() === groupId)) {
        res.status(401).send("User has blocked the group");
        return;
      }

      group.groupMembers = [...group.groupMembers, requestUser._id];
      requestUser.groupList = [...requestUser.groupList, group._id];

      let [groupRes] = await Promise.all([
        group.save(),
        requestUser.save(),
      ]).then((result) => {
        const userToAddClient = findWsUser(userIdToAdd);
        if (userToAddClient) {
          userToAddClient.send(
            JSON.stringify({
              request: "added-to-group",
              body: {
                groupId,
                userId: user._id.toString(),
                userName: user.userName,
              },
            })
          );
        }

        for (const member of group.groupMembers) {
          const memberId = member.toString();

          const wsClient = findWsUser(memberId);
          if (wsClient) {
            wsClient.send(
              JSON.stringify({
                request: "group-add",
                body: {
                  groupId,
                  userId,
                  userName: user.userName,
                  addedUser: userIdToAdd,
                },
              })
            );
          }
        }

        return result;
      });

      res.status(200).send(groupRes);
    } catch (err) {
      res.status(500).send(err);
    }
  }
);

GroupRouter.post(
  "/groups/:groupId/removeUser/:id",
  checkAuth,
  async (req, res) => {
    try {
      let { user } = req;
      const groupId = req.params.groupId;
      const userId = req.params.id;
      let group = await Group.findById(groupId);
      if (!group) {
        throw new Error("Could not find group");
      }

      let requestUser = undefined;
      if (user._id.toString() === userId) {
        requestUser = user;
      } else {
        if (
          !group.groupAdmins.find((id) => id.toString() === user._id.toString())
        ) {
          res.status(401).send("Can not operate if user is not admin");
          return;
        }

        requestUser = await User.findById(userId);
        if (!requestUser) {
          res.status(404).send("Could not find user");
          return;
        }

        if (group.createdBy.id.toString() === userId) {
          res.status(403).send("Can not remove the creator of the group");
          return;
        }
      }

      if (!group.groupMembers.find((id) => id.toString() === userId)) {
        res
          .status(401)
          .send("Can not remove user that is not part of the group");
        return;
      }

      group.groupMembers = group.groupMembers.filter(
        (id) => id.toString() !== requestUser._id.toString()
      );
      group.groupAdmins = group.groupAdmins.filter(
        (id) => id.toString() !== requestUser._id.toString()
      );
      requestUser.groupList = requestUser.groupList.filter(
        (id) => id.toString() !== group._id.toString()
      );

      if (!group.groupMembers.length) {
        await Promise.all([
          Message.deleteMany({ groupId }),
          Group.deleteOne({ _id: groupId }),
        ]).then(() => {
          res.status(200).send();
        });
      } else {
        if (!group.groupAdmins.length) {
          group.groupAdmins = [group.groupMembers[0]];
        }

        const [groupRes] = await Promise.all([
          group.save(),
          requestUser.save(),
        ]).then((res) => {
          let wsClient = findWsUser(userId);
          if (wsClient) {
            wsClient.send(
              JSON.stringify({
                request: "removed-from-group",
                body: {
                  groupId,
                  groupName: group.groupName,
                  userId: user._id,
                  userName: user.name,
                },
              })
            );
          }

          for (const member of group.groupMembers) {
            const memberId = member.toString();
            const wsClient = findWsUser(memberId);
            if (wsClient) {
              wsClient.send(
                JSON.stringify({
                  request: "group-remove",
                  body: {
                    groupId,
                    groupName: group.groupName,
                    userId: user._id,
                    userName: user.userName,
                    removedUser: userId,
                    isAdmin: group.groupAdmins.find(
                      (id) => id.toString() === memberId
                    ),
                  },
                })
              );
            }
          }

          return res;
        });

        res.status(200).send(groupRes);
      }
    } catch (err) {
      res.status(500).send(err);
    }
  }
);

GroupRouter.post(
  "/groups/:groupId/addAdmin/:id",
  checkAuth,
  async (req, res) => {
    try {
      let { user } = req;
      const groupId = req.params.groupId;
      let userId = req.params.id;
      let group = await Group.findById(groupId);
      if (!group) {
        res.status(404).send("Group not found!");
        return;
      }

      if (
        !group.groupAdmins.find((id) => id.toString() === user._id.toString())
      ) {
        res.status(401).send("Cannot operate if user is not admin");
        return;
      }

      if (!group.groupMembers.find((id) => id.toString() === userId)) {
        res
          .status(403)
          .send("Cannot admin a user that is not part of the group");
        return;
      }

      if (group.groupAdmins.find((id) => id.toString() === userId)) {
        res.status(401).send("Cannot admin an admin");
        return;
      }

      if (user._id.toString() === userId) {
        res.status(401).send("Can not admin yourself");
        return;
      }

      let memberId = group.groupMembers.find((id) => id.toString() === userId);

      group.groupAdmins = [...group.groupAdmins, memberId];
      group = await group.save();

      for (const member of group.groupMembers) {
        const memberId = member.toString();
        const wsClient = findWsUser(memberId);
        if (wsClient) {
          wsClient.send(
            JSON.stringify({
              request: "added-admin",
              body: {
                groupId: group._id.toString(),
                groupName: group.groupName,
                userId: user._id,
                userName: user.userName,
                newAdmin: userId,
              },
            })
          );
        }
      }

      res.status(200).send(group);
    } catch (err) {
      res.status(500).send(err);
    }
  }
);

GroupRouter.post(
  "/groups/:groupId/removeAdmin/:id",
  checkAuth,
  async (req, res) => {
    try {
      let { user } = req;
      const groupId = req.params.groupId;
      const userId = req.params.id;
      let group = await Group.findById(groupId);
      if (!group) {
        res.status(404).send("Group not found!");
        return;
      }

      if (
        !group.groupAdmins.find((id) => id.toString() === user._id.toString())
      ) {
        res.status(401).send("Cannot operate if user is not admin");
        return;
      }

      if (!group.groupAdmins.find((id) => id.toString() === userId)) {
        res.status(403).send("Cannot demote a user that is not an admin");
        return;
      }

      group.groupAdmins = group.groupAdmins.filter(
        (id) => id.toString() !== userId
      );
      group = await group.save();

      for (const member of group.groupMembers) {
        const memberId = member.toString();

        const wsClient = findWsUser(memberId);
        if (!wsClient) {
          continue;
        }

        wsClient.send(
          JSON.stringify({
            request: "removed-admin",
            body: {
              removedAdmin: userId,
              userName: user.userName,
              groupId: group._id,
              groupName: group.groupName,
            },
          })
        );
      }

      res.status(200).send(group);
    } catch (err) {
      res.status(500).send(err);
    }
  }
);

module.exports = GroupRouter;

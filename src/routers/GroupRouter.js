const express = require("express");
const { checkAuth } = require("../middleware");
const { Group, User, Message } = require("../models");
const { findWsUser } = require("../socket");

const GroupRouter = express.Router();

GroupRouter.post("/groups", checkAuth, async (req, res) => {
  try {
    let { user } = req;
    const { groupName } = req.body;
    let group = new Group({
      groupName,
      groupMembers: [user._id],
      groupAdmins: [user._id],
      createdBy: {
        name: user.userName,
        id: user._id,
      },
    });
    group = await group.save();

    res.status(200).send(group);
  } catch (err) {
    res.status(500).status(err);
  }
});

GroupRouter.delete("/groups/:id", checkAuth, async (req, res) => {
  try {
    let { user } = req;
    const groupId = req.params.id;
    let group = await Group.findById(groupId);
    if (!group) {
      throw new Error("Could not find group");
    }

    if (!group.groupAdmins.find((id) => id.toString() === user._id)) {
      throw new Error("Cannot operate if user is not admin");
    }

    await Promise.all([
      User.findMany({
        groupList: { $elemMatch: groupId },
      }),
      Message.deleteMany({ groupId }),
      Group.deleteOne(group._id),
    ]).then(async (res) => {
      let members = res?.[0];
      if (Array.isArray(members)) {
        for (let i = 0; i < members.length; i++) {
          let groupList = members[i]["groupList"].filter(
            (id) => id.toString() !== groupId
          );
          members[i]["groupList"] = groupList;
        }
        await Promise.allSettled(
          members.map(async (member) => await member.save())
        ).then((membersRes) => {
          for (const member of membersRes) {
            let memberId = member._id.toString();
            let wsClient = findWsUser(memberId);
            if (wsClient) {
              wsClient.send(
                JSON.stringify({
                  request: "group-delete",
                  body: {
                    groupId,
                    userName: user.userName,
                    id: user._id,
                  },
                })
              );
            }
          }

          res.status(200).send();
        });
      } else {
        throw new Error("Could not get group members");
      }
    });
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
      const userId = req.params.id;
      let group = await Group.findById(groupId);
      if (!group) {
        throw new Error("Could not find group");
      }

      if (
        !group.groupAdmins.includes(
          (id) => id.toString() === user._id.toString()
        )
      ) {
        throw new Error("Cannot operate if user is not admin");
      }

      if (group.groupMembers.includes((id) => id.toString() === userId)) {
        throw new Error("Cannot add the same member twice");
      }

      let requestUser = await User.findById(userId);
      if (!requestUser) {
        throw new Error("Could not find user");
      }

      if (requestUser.groupBlock.includes((id) => id.toString() === groupId)) {
        throw new Error("User has blocked the group");
      }

      group.groupMembers = [...group.groupMembers, requestUser._id];
      requestUser.groupList = [...requestUser.groupList, group._id];

      let [groupRes] = await Promise.all([
        group.save(),
        requestUser.save(),
      ]).then((res) => {
        let ws = findWsUser(userId);
        if (ws) {
          ws.send(
            JSON.stringify({
              request: "group-add",
              body: {
                groupId: group._id,
                groupName: group.groupName,
                addedById: user._id,
                addedByName: user.userName,
              },
            })
          );
        }

        return res;
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

      if (!group.groupAdmins.includes((id) => id.toString() === user._id)) {
        throw new Error("Can not operate if user is not admin");
      }

      if (!group.groupMembers.includes((id) => id.toString() === userId)) {
        throw new Error("Can not remove user that is not part of the group");
      }

      let requestUser = await User.findById(userId);
      if (!requestUser) {
        throw new Error("Could not find user");
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
          Group.deleteOne(groupId),
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
                request: "group-remove",
                groupId,
                groupName: group.groupName,
                userId: user._id,
                userName: user.name,
              })
            );
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
        throw new Error("Could not find group");
      }

      if (
        !group.groupAdmins.includes(
          (id) => id.toString() === user._id.toString()
        )
      ) {
        throw new Error("Cannot operate if user is not admin");
      }

      if (!group.groupMembers.includes((id) => id.toString() === userId)) {
        throw new Error("Cannot admin a user that is not part of the group");
      }

      if (group.groupAdmins.includes((id) => id.toString() === userId)) {
        throw new Error("Cannot admin an admin");
      }

      let memberId = group.groupMembers.find((id) => id.toString() === userId);

      group.groupAdmins = [...group.groupAdmins, memberId];
      group = await group.save();

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
        throw new Error("Could not find group");
      }

      if (
        !group.groupAdmins.includes(
          (id) => id.toString() === user._id.toString()
        )
      ) {
        throw new Error("Cannot operate if user is not admin");
      }

      if (!group.groupAdmins.includes((id) => id.toString() === userId)) {
        throw new Error("Cannot remove a user that is not part of the admins");
      }

      group.groupAdmins = group.groupAdmins.filter(
        (id) => id.toString() !== userId
      );
      group = await group.save();

      res.status(200).send(group);
    } catch (err) {
      res.status(500).send(err);
    }
  }
);

module.exports = GroupRouter;

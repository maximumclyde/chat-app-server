const { Router } = require("express");
const multer = require("multer");
const { checkAuth } = require("../middleware");
const { User, Preference, Group, Message } = require("../models");
const { findWsUser } = require("../socket");

const router = Router();
const upload = multer();

const allowedChangeKeys = ["userName", "userEmail", "userPassword"];
const ALLOWED_QUERY = /[A-Za-z0-9\s]/;

router.post("/users", async (req, res) => {
  try {
    let user = await new User(req.body).save();
    const [token, userPreferences] = await Promise.all([
      await user.generateToken(),
      await new Preference({
        userId: user._id,
        preferences: {
          theme: "dark",
        },
      }).save(),
    ]);

    return res.status(200).send({
      user,
      token,
      userPreferences,
    });
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get("/users/profile", checkAuth, async (req, res) => {
  const { user } = req;

  try {
    const [userPreferences, friends, userGroups] = await Promise.all([
      Preference.findOne({ userId: user._id }),
      User.find(
        {
          friendList: {
            $elemMatch: { $eq: user._id },
          },
        },
        "userName userEmail friendList _id"
      ),
      Group.find({
        groupMembers: {
          $elemMatch: { $eq: user._id },
        },
      }),
    ]);
    res.status(200).send({ user, userPreferences, friends, userGroups });
  } catch (err) {
    res.status(500).send(err);
  }
});

router.post(
  "/users/avatar",
  checkAuth,
  upload.single("avatar"),
  async (req, res) => {
    const { user, file } = req;
    try {
      user.avatar = file.buffer;
      await user.save();
      res.status(200).send(user);
    } catch (err) {
      res.status(500).send(err);
    }
  }
);

router.post("/users/login", async (req, res) => {
  try {
    const { email, password } = req?.body;
    const user = await User.findByCredentials(email, password);
    if (!user) {
      throw new Error("User was not found");
    }

    const [token, userPreferences] = await Promise.all([
      await user.generateToken(),
      await Preference.findOne({ userId: user._id }),
    ]);

    res.status(200).send({ user, token, userPreferences });
  } catch (err) {
    res.status(500).send(err);
  }
});

router.post("/users/logout", checkAuth, async (req, res) => {
  try {
    const { token, user } = req;
    user.tokens = user.tokens?.filter(({ token: t }) => t !== token);
    await user.save();
    res.status(200).send();
  } catch (err) {
    res.status(500).send(err);
  }
});

router.post("/users/logoutAll", checkAuth, async (req, res) => {
  try {
    const { user } = req;
    user.tokens = [];
    await user.save();
    res.status(200).send();
  } catch (err) {
    res.status(500).send(err);
  }
});

router.patch("/users/profile", checkAuth, async (req, res) => {
  try {
    let { user } = req;
    for (const key in req.body) {
      if (allowedChangeKeys.includes(key)) {
        user[key] = req.body[key];
      }
    }
    user = await user.save();
    return res.status(200).send(user);
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get("/users/:userId", checkAuth, async (req, res) => {
  try {
    let { user } = req;
    let userId = req.params.userId;
    if (user.blockedBy.find((id) => id.toString() === userId)) {
      throw new Error("Cannot get a user that blocked you");
    }

    let requestUser = await User.findById(userId);
    if (!requestUser) {
      throw new Error("Could not find user");
    }

    delete requestUser["userEmail"];
    delete requestUser["friendRequests"];
    delete requestUser["requestsMade"];
    delete requestUser["groupList"];
    delete requestUser["userBlock"];
    delete requestUser["blockedBy"];
    delete requestUser["groupBlock"];

    res.status(200).send(requestUser);
  } catch (err) {
    res.status(500).send(err);
  }
});

router.delete("/users/profile", checkAuth, async (req, res) => {
  try {
    await Promise.all([
      User.deleteOne({ _id: req.user._id }),
      Preference.deleteOne({ userId: req.user._id }),
      Group.updateMany(
        {
          groupMembers: {
            $elemMatch: { $eq: user._id },
          },
        },
        {
          $pull: {
            groupMembers: {
              $elemMatch: { $eq: user._id },
            },
            groupAdmins: {
              $elemMatch: { $eq: user._id },
            },
          },
        }
      ),
      User.updateMany(
        {
          $or: [
            {
              friendList: {
                $elemMatch: { $eq: user._id },
              },
            },
            {
              friendRequests: {
                $elemMatch: { $eq: user._id },
              },
            },
            {
              requestsMade: {
                $elemMatch: { $eq: user._id },
              },
            },
            {
              userBlock: {
                $elemMatch: { $eq: user._id },
              },
            },
            {
              blockedBy: {
                $elemMatch: { $eq: user._id },
              },
            },
            {
              friendList: {
                $elemMatch: { $eq: user._id },
              },
            },
          ],
        },
        {
          $pull: {
            friendList: {
              $elemMatch: { $eq: user._id },
            },
            friendRequests: {
              $elemMatch: { $eq: user._id },
            },
            requestsMade: {
              $elemMatch: { $eq: user._id },
            },
            userBlock: {
              $elemMatch: { $eq: user._id },
            },
            blockedBy: {
              $elemMatch: { $eq: user._id },
            },
            friendList: {
              $elemMatch: { $eq: user._id },
            },
          },
        }
      ),
      Message.deleteMany({
        $or: [{ senderId: user._id }, { receiverId: user._id }],
      }),
    ]);
    return res.status(200).send();
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.post("/users/request/:id", checkAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const { user } = req;
    let userToRequest = await User.findById(userId);
    if (!userToRequest) {
      throw new Error("User was not found");
    }

    if (user.userBlock.includes(userId) || user.blockedBy.includes(userId)) {
      throw new Error("No operations allowed with blocked users");
    }

    if (
      userToRequest.userBlock.find(
        (id) => id.toString() === user._id.toString()
      ) ||
      userToRequest.blockedBy.find(
        (id) => id.toString() === user._id.toString()
      )
    ) {
      throw new Error("Can not send requests to a user that blocked you");
    }

    if (user.requestsMade.find((id) => id.toString() === userId)) {
      throw new Error("Can not request multiple time to the same user");
    }

    if (user.friendRequests.find((id) => id.toString() === userId)) {
      throw new Error(
        "Can not make a request to a user that has already made a request to you"
      );
    }

    if (user.friendList.find((id) => id.toString() === userId)) {
      throw new Error("Can not make a request to a friend");
    }

    user.requestsMade = [...user.requestsMade, userToRequest._id];
    userToRequest.friendRequests = [...userToRequest.friendRequests, user._id];

    const [userRes] = await Promise.all([
      await user.save(),
      await userToRequest.save(),
    ]).then((res) => {
      let wsClient = findWsUser(userId);
      if (wsClient) {
        wsClient.send(
          JSON.stringify({
            request: "friend-request",
            body: {
              _id: user._id,
              userName: user.userName,
            },
          })
        );
      }

      return res;
    });

    res.status(200).send(userRes);
  } catch (err) {
    res.status(500).send(err);
  }
});

router.post("/users/accept/:id", checkAuth, async (req, res) => {
  try {
    const { user } = req;
    const requestUserId = req.params.id;
    const requestUser = await User.findById(requestUserId);

    if (!requestUser) {
      user.friendRequests = user.friendRequests.filter(
        (id) => id.toString() !== requestUserId
      );
      user.save();
      throw new Error("Request user was not found");
    }

    if (
      user.userBlock.find((id) => id.toString() === requestUserId) ||
      user.blockedBy.find((id) => id.toString() === requestUserId)
    ) {
      throw new Error("No operations allowed with blocked users");
    }

    if (
      !requestUser.requestsMade.find(
        (id) => id.toString() === user._id.toString()
      )
    ) {
      throw new Error("Request was not found");
    }

    if (!user.friendRequests.find((id) => id.toString() === requestUserId)) {
      throw new Error("Request was not found");
    }

    requestUser.requestsMade = requestUser.requestsMade.filter(
      (id) => id.toString() !== user._id.toString()
    );
    requestUser.friendList = [...requestUser.friendList, user._id];

    user.friendRequests = user.friendRequests.filter(
      (id) => id.toString() !== requestUser._id.toString()
    );
    user.friendList = [...user.friendList, requestUserId];
    const [userRes] = await Promise.all([user.save(), requestUser.save()]).then(
      (res) => {
        let wsClient = findWsUser(requestUserId);
        if (wsClient) {
          wsClient.send(
            JSON.stringify({
              request: "request-accept",
              body: {
                _id: user._id,
                userName: user.userName,
              },
            })
          );
        }

        return res;
      }
    );

    res.status(200).send(userRes);
  } catch (err) {
    res.status(500).send(err);
  }
});

router.post("/users/decline/:id", checkAuth, async (req, res) => {
  try {
    const { user } = req;
    let requestUserId = req.params.id;
    let requestUser = await User.findById(requestUserId);

    user.friendRequests = user.friendRequests.filter(
      (id) => id.toString() !== requestUserId
    );

    if (
      !requestUser ||
      !user.friendRequests.find((id) => id.toString() === requestUserId)
    ) {
      user.save();
      throw new Error("Request user was not found");
    }

    if (
      user.userBlock.find((id) => id.toString() === requestUserId) ||
      user.blockedBy.find((id) => id.toString() === requestUserId)
    ) {
      throw new Error("No operations allowed with blocked users");
    }

    user.friendRequests = user.friendRequests.filter(
      (id) => id.toString() !== requestUserId
    );
    requestUser.requestsMade = requestUser.requestsMade.filter(
      (id) => id.toString() !== user._id.toString()
    );

    const [userRes] = await Promise.all([user.save(), requestUser.save()]).then(
      (res) => {
        let wsClient = findWsUser(requestUserId);
        if (wsClient) {
          wsClient.send(
            JSON.stringify({
              request: "request-decline",
              body: {
                _id: user._id,
                userName: user.userName,
              },
            })
          );
        }
        return res;
      }
    );

    res.status(200).send(userRes);
  } catch (err) {
    res.status(500).send(err);
  }
});

router.post("/users/unfriend/:id", checkAuth, async (req, res) => {
  try {
    const { user } = req;
    const relatedUserId = req.params.id;
    let relatedUser = await User.findById(relatedUserId);

    if (!relatedUser) {
      user.friendList = user.friendList.filter(
        (id) => id.toString() !== relatedUserId
      );
      user.save();
      throw new Error("Friend was not found");
    }

    if (
      user.userBlock.find((id) => id.toString() === relatedUserId) ||
      user.blockedBy.find((id) => id.toString() === relatedUserId)
    ) {
      throw new Error("No operations allowed with blocked users");
    }

    if (!user.friendList.find((id) => id.toString() === relatedUserId)) {
      throw new Error("Can not unfriend a user who is not your friend");
    }

    user.friendList = user.friendList.filter(
      (id) => id.toString() !== relatedUserId
    );
    relatedUser.friendList = relatedUser.friendList.filter(
      (id) => id.toString() !== user._id.toString()
    );

    const [userRes] = await Promise.all([user.save(), relatedUser.save()]).then(
      (res) => {
        let wsClient = findWsUser(relatedUserId);
        if (wsClient) {
          wsClient.send(
            JSON.stringify({
              request: "unfriended",
              body: {
                _id: user._id,
                userName: user.userName,
              },
            })
          );
        }

        return res;
      }
    );

    res.status(200).send(userRes);
  } catch (err) {
    res.status(500).send(err);
  }
});

router.post("/users/block/:id", checkAuth, async (req, res) => {
  try {
    const { user } = req;
    const blockId = req.params.id;
    let blockUser = await User.findById(blockId);

    if (!blockUser) {
      throw new Error("Block user was not found");
    }

    if (
      user.userBlock.find((id) => id.toString() === blockId) ||
      user.blockedBy.find((id) => id.toString() === blockId)
    ) {
      throw new Error("No operations allowed with blocked users");
    }

    blockUser.friendList = blockUser.friendList.filter(
      (id) => id.toString() !== blockId
    );
    blockUser.friendRequests = blockUser.friendRequests.filter(
      (id) => id.toString() !== blockId
    );
    blockUser.requestsMade = blockUser.requestsMade.filter(
      (id) => id.toString() !== blockId
    );

    user.friendList = user.friendList.filter((id) => id.toString() !== blockId);
    user.friendRequests = user.friendRequests.filter(
      (id) => id.toString() !== blockId
    );
    user.requestsMade = user.requestsMade.filter(
      (id) => id.toString() !== blockId
    );
    user.userBlock = [...user.userBlock, blockId];
    blockUser.blockedBy = [...blockUser.blockedBy, user._id];

    const [userRes] = await Promise.all([user.save(), blockUser.save()]).then(
      (res) => {
        let wsClient = findWsUser(blockId);
        if (wsClient) {
          wsClient.send(
            JSON.stringify({
              request: "blocked",
              body: {
                _id: user._id,
                userName: user.userName,
              },
            })
          );
        }

        return res;
      }
    );

    return res.status(200).send(userRes);
  } catch (err) {
    res.status(500).send(err);
  }
});

router.post("/users/unblock/:id", checkAuth, async (req, res) => {
  try {
    let { user } = req;
    const blockId = req.params.id;
    let blockUser = await User.findById(blockId);

    if (!blockUser || !user.userBlock.find((id) => id.toString() === blockId)) {
      throw new Error("Blocked suer was not found");
    }

    user.userBlock = user.userBlock.filter((id) => id.toString() !== blockId);
    blockUser.blockedBy = blockUser.blockedBy.filter(
      (id) => id.toString() !== user._id.toString()
    );
    const [userRes] = await Promise.all([user.save(), blockUser.save()]).then(
      (res) => {
        let wsClient = findWsUser(blockId);
        if (wsClient) {
          wsClient.send(
            JSON.stringify({
              request: "unblocked",
              body: {
                _id: user._id,
                userName: user.userName,
              },
            })
          );
        }

        return res;
      }
    );
    res.status(200).send(userRes);
  } catch (err) {
    res.status(500).send(err);
  }
});

router.post("/userQuery", checkAuth, async (req, res) => {
  let { query = "" } = req.body;
  let { user } = req;

  if (!query) {
    res.status(200).send([]);
    return;
  }

  try {
    if (!ALLOWED_QUERY.test(query)) {
      throw new Error("Not allowed characters found in query!");
    }

    if (query.length < 3) {
      throw new Error("Not enough characters");
    }

    let filters = await User.find(
      {
        userName: {
          $regex: `${query}`,
          $options: "i",
        },
        _id: {
          $nin: [user._id],
        },
        friendList: {
          $nin: [user._id],
        },
        userBlock: {
          $nin: [user._id],
        },
        blockedBy: {
          $nin: [user._id],
        },
      },
      "userName userEmail _id avatar"
    );
    res.status(200).send(filters);
  } catch (err) {
    res.status(500).send(err);
  }
});

module.exports = router;

const { Router } = require("express");
const { checkAuth } = require("../middleware");
const { User } = require("../models");
const { findWsUser } = require("../socket");

const router = Router();

router.post("/users", async (req, res) => {
  try {
    let user = await new User(req.body).save();
    let token = await user.generateToken();
    return res.status(200).send({
      user,
      token,
    });
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.post("/users/login", async (req, res) => {
  try {
    const { email, password } = req?.body;
    const user = await User.findByCredentials(email, password);
    if (!user) {
      throw new Error("User was not found");
    }

    const token = await user.generateToken();
    res.status(200).send({ user, token });
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

router.patch("/users", checkAuth, async (req, res) => {
  try {
    let user = { ...req.user, ...req.body };
    user = await user.save();
    return res.status(200).send(user);
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.delete("/users/profile", checkAuth, async (req, res) => {
  try {
    await User.deleteOne({ _id: req.user._id });
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
      userToRequest.blockUser.includes(user._id) ||
      userToRequest.blockedBy.includes(user._id)
    ) {
      throw new Error("Can not send requests to a user that blocked you");
    }

    if (user.requestsMade.includes(userId)) {
      throw new Error("Can not request multiple time to the same user");
    }

    if (user.friendRequests.includes(userId)) {
      throw new Error(
        "Can not make a request to a user that has already made a request to you"
      );
    }

    if (user.friendList.includes(userId)) {
      throw new Error("Can not make a request to a friend");
    }

    user.requestsMade = [...user.requestsMade, userId];
    userToRequest.friendRequests = [...userToRequest.friendRequests, user._id];

    const [userRes] = await Promise.all([
      user.save(),
      userToRequest.save(),
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
        (id) => id !== requestUserId
      );
      user.save();
      throw new Error("Request user was not found");
    }

    if (
      user.userBlock.includes(requestUserId) ||
      user.blockedBy.includes(requestUserId)
    ) {
      throw new Error("No operations allowed with blocked users");
    }

    if (!requestUser.requestsMade.includes(user._id)) {
      throw new Error("Request was not found");
    }

    if (!user.friendRequests.includes(requestUserId)) {
      throw new Error("Request was not found");
    }

    requestUser.requestsMade = requestUser.requestsMade.filter(
      (id) => id !== user._id
    );
    requestUser.friendList = [...requestUser.friendList, user._id];
    user.requestsMade = user.friendRequests.filter(
      (id) => id !== requestUserId
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
      (id) => id !== requestUserId
    );

    if (!requestUser) {
      user.save();
      throw new Error("Request user was not found");
    }

    if (
      user.userBlock.includes(requestUserId) ||
      user.blockedBy.includes(requestUserId)
    ) {
      throw new Error("No operations allowed with blocked users");
    }

    user.friendRequests = user.friendRequests.filter(
      (id) => id !== requestUserId
    );
    requestUser.requestsMade = requestUser.requestsMade.filter(
      (id) => id !== user._id
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
      user.friendList = user.friendList.filter((id) => id !== relatedUserId);
      user.save();
      throw new Error("Friend was not found");
    }

    if (
      user.userBlock.includes(relatedUserId) ||
      user.blockedBy.includes(relatedUserId)
    ) {
      throw new Error("No operations allowed with blocked users");
    }

    if (!user.friendList.includes(relatedUserId)) {
      throw new Error("Can not unfriend a user who is not your friend");
    }

    user.friendList = user.friendList.filter((id) => id !== relatedUserId);
    relatedUser.friendList = relatedUser.filter((id) => id !== user._id);

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

    user.friendList = user.friendList.filter((id) => id !== blockId);
    user.friendRequests = user.friendRequests.filter((id) => id !== blockId);
    user.requestsMade = user.requestsMade.filter((id) => id !== blockId);
    user.userBlock = [...user.userBlock, blockId];

    if (!blockUser) {
      user.save();
      throw new Error("Block user was not found");
    }

    if (user.userBlock.includes(blockId) || user.blockedBy.includes(blockId)) {
      throw new Error("No operations allowed with blocked users");
    }

    blockUser.friendList = blockUser.friendList.filter((id) => id !== blockId);
    blockUser.friendRequests = blockUser.friendRequests.filter(
      (id) => id !== blockId
    );
    blockUser.requestsMade = blockUser.requestsMade.filter(
      (id) => id !== blockId
    );
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

    user.userBlock = user.userBlock.filter((id) => id !== blockId);

    if (!blockUser) {
      user.save();
      throw new Error("Blocked suer was not found");
    }

    blockUser.blockedBy = blockUser.blockedBy.filter((id) => id !== user._id);
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

module.exports = router;

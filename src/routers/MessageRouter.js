const express = require("express");
const { checkAuth } = require("../middleware");
const { Message, Group } = require("../models");
const { findWsUser } = require("../socket");

const MessageRouter = express.Router();

MessageRouter.get("/message/:userId", checkAuth, async (req, res) => {
  try {
    let { user } = req.body;
    let friendId = req.params.userId;

    if (!user.friendList.includes(friendId)) {
      throw new Error("Cannot get messages between users that are not friends");
    }

    let messages = await Message.find({
      $where: `(this.senderId === ${user._id} && this.receiverId === ${friendId}) || (this.senderId === ${friendId} && this.receiverId === ${user._id})`,
    });
    res.status(200).send(messages);
  } catch (err) {
    res.status(500).send(err);
  }
});

MessageRouter.get("/message/group/:id", checkAuth, async (req, res) => {
  try {
    let { user } = req;
    let groupId = req.params.id;
    if (!user.groupList) {
      throw new Error("Cannot get messages to a group you are not part of");
    }

    let messages = await Message.find({ groupId });
    res.status(200).send(messages);
  } catch (err) {
    res.status(500).send(err);
  }
});

MessageRouter.post("/message/:userId", checkAuth, async (req, res) => {
  try {
    let { user } = req.body;
    let friendId = req.params.userId;
    let { content } = req.body;

    if (!user.friendList.includes(friendId)) {
      throw new Error(
        "Can not send a message to a user that's not your friend"
      );
    }

    let message = new Message({
      content,
      senderId: user._id,
      receiverId: friendId,
    });

    message = await message.save();

    let socketClient = findWsUser(friendId);
    if (socketClient) {
      socketClient.send(
        JSON.stringify({
          request: "message-received",
          body: {
            content,
            senderId: user._id,
            createdAt: message.createdAt,
          },
        })
      );
    }

    res.status(200).send(message);
  } catch (err) {
    res.status(500).send(err);
  }
});

MessageRouter.post("/message/group/:groupId", checkAuth, async (req, res) => {
  try {
    let { user } = req;
    const { content } = req.body;
    let groupId = req.params.groupId;

    if (!user.groupList.includes(groupId)) {
      throw new Error("Cannot send messages to a group you are not a part to");
    }

    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error("Could not find group");
    }

    let message = new Message({
      content,
      senderId: user._id,
      groupId,
    });

    message = await message.save();

    for (const memberId of group.groupMembers) {
      if (memberId !== user._id) {
        let ws = findWsUser(memberId);
        if (ws) {
          ws.send(
            JSON.stringify({
              request: "group-message",
              body: {
                content,
                senderId: message.senderId,
                groupId: message.groupId,
                createdAt: message.createdAt,
              },
            })
          );
        }
      }
    }

    res.status(200).send(message);
  } catch (err) {
    res.status(500).send(err);
  }
});

module.exports = MessageRouter;

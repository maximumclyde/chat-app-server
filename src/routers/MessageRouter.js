const express = require("express");
const { checkAuth } = require("../middleware");
const { Message, Group, User } = require("../models");
const { findWsUser } = require("../socket");

const MessageRouter = express.Router();

MessageRouter.get("/message/:userId", checkAuth, async (req, res) => {
  try {
    let { user } = req;
    let friendId = req.params.userId;
    let { messagesExchanged } = req.query;

    if (!user.friendList.find((id) => id.toString() === friendId)) {
      throw new Error("Cannot get messages between users that are not friends");
    }

    let messages = await Message.find({
      $and: [
        { $or: [{ senderId: user._id.toString() }, { senderId: friendId }] },
        {
          $or: [{ receiverId: user._id.toString() }, { receiverId: friendId }],
        },
      ],
    })
      .sort({ createdAt: -1 })
      .skip(+messagesExchanged)
      .limit(30);
    res.status(200).send(messages);
  } catch (err) {
    res.status(500).send(err);
  }
});

MessageRouter.get("/message/group/:id", checkAuth, async (req, res) => {
  try {
    let { user } = req;
    let groupId = req.params.id;
    let { messagesExchanged } = req.query;

    if (!user.groupList.find((id) => id.toString() === groupId)) {
      throw new Error("Cannot get messages to a group you are not part of");
    }

    let group = await Group.findById(groupId);
    if (!group) {
      throw new Error("Group was not found");
    }

    let messages = await Message.find({ groupId })
      .sort({ createdAt: -1 })
      .skip(+messagesExchanged)
      .limit(30);

    res.status(200).send(messages);
  } catch (err) {
    res.status(500).send(err);
  }
});

MessageRouter.post("/message/:userId", checkAuth, async (req, res) => {
  try {
    let { user } = req;
    let friendId = req.params.userId;
    let { content } = req.body;

    if (!user.friendList.find((id) => id.toString() === friendId)) {
      throw new Error(
        "Can not send a message to a user that's not your friend"
      );
    }

    let friend = await User.findById(friendId);
    if (!friend) {
      throw new Error("Friend could not be found");
    }

    let message = new Message({
      content,
      senderName: user.userName,
      senderId: user._id,
      receiverId: friend._id,
    });

    message = await message.save();

    let socketClient = findWsUser(friendId);
    if (socketClient) {
      socketClient.send(
        JSON.stringify({
          request: "message-received",
          body: message,
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

    if (!user.groupList.find((id) => id.toString() === groupId)) {
      throw new Error("Cannot send messages to a group you are not a part to");
    }

    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error("Could not find group");
    }

    let message = new Message({
      content,
      senderName: user.userName,
      senderId: user._id,
      groupId: group._id,
    });

    message = await message.save();

    for (const memberId of group.groupMembers) {
      if (memberId !== user._id) {
        let ws = findWsUser(memberId);
        if (ws) {
          ws.send(
            JSON.stringify({
              request: "group-message",
              body: message,
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

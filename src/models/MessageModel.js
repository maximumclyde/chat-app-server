const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
      trim: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderId: {
      type: mongoose.Schema.ObjectId,
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.ObjectId,
      required: false,
    },
    groupId: {
      type: mongoose.Schema.ObjectId,
      required: false,
    },
    messageStatus: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
    skipVersioning: true,
  }
);

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;

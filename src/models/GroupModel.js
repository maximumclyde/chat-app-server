const mongoose = require("mongoose");
const { Message } = require("../models");

const groupSchema = new mongoose.Schema(
  {
    groupName: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: Buffer,
      required: false,
    },
    groupMembers: {
      type: [mongoose.Schema.ObjectId],
      required: true,
    },
    groupAdmins: {
      type: [mongoose.Schema.ObjectId],
      required: true,
    },
    createdBy: {
      name: {
        type: String,
        required: true,
      },
      id: {
        type: mongoose.Schema.ObjectId,
        required: true,
      },
    },
  },
  {
    timestamps: true,
    skipVersioning: true,
  }
);

groupSchema.post("updateMany", async function () {
  try {
    let group = this;
    if (group.groupMembers.length) {
      if (!group.groupAdmins.length) {
        group.groupAdmins = [group.groupMembers[0]];
        await group.save().catch((err) => {
          console.log("Error updating group: ", err);
        });
      }
    } else {
      await Promise.allSettled([
        Group.deleteOne({ _id: group._id }),
        Message.deleteMany({ groupId: group._id }),
      ]).catch((err) => {
        console.log("Error deleting group resources: ", err);
      });
    }
  } catch {}
});

const Group = mongoose.model("Group", groupSchema);

module.exports = Group;

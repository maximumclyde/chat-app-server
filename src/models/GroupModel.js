const mongoose = require("mongoose");

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

groupSchema.post("updateMany", async function (next) {
  try {
    let group = this;
    if (group.groupMembers.length) {
      if (!group.groupAdmins.length) {
        group.groupAdmins = [group.groupMembers[0]];
        await group.save();
      }
    } else {
      await Group.deleteOne({ _id: group._id });
    }
  } catch {}

  next();
});

const Group = mongoose.model("Group", groupSchema);

module.exports = Group;

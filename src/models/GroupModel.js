const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    groupName: {
      type: String,
      required: true,
      trim: true,
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

const Group = mongoose.model("Group", groupSchema);

module.exports = Group;

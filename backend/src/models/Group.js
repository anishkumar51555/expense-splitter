const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // 👈 IMPORTANT
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    inviteCode: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Group", groupSchema);
const mongoose = require("mongoose");

/**
 * How far through a group's chat one person has read.
 *
 * Kept out of the Message document because it is per-viewer, not per-message:
 * a read marker on the message itself would mean rewriting every message each
 * time somebody opened the tab.
 */
const chatReadSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    lastReadAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

chatReadSchema.index({ user: 1, group: 1 }, { unique: true });

module.exports = mongoose.model("ChatRead", chatReadSchema);

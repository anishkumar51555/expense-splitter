const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
  },
  { timestamps: true }
);

// Every read is "this group's messages, oldest first", and polling asks for
// the tail of that same order.
messageSchema.index({ group: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);

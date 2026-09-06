const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  listMessages,
  sendMessage,
  unreadCount,
  markRead,
} = require("../controllers/messageController");

router.get("/:groupId/unread", authMiddleware, unreadCount);
router.post("/:groupId/read", authMiddleware, markRead);
router.get("/:groupId", authMiddleware, listMessages);
router.post("/:groupId", authMiddleware, sendMessage);

module.exports = router;

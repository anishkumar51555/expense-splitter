const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { listMessages, sendMessage } = require("../controllers/messageController");

router.get("/:groupId", authMiddleware, listMessages);
router.post("/:groupId", authMiddleware, sendMessage);

module.exports = router;

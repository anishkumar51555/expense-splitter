const express = require("express");
const router = express.Router();
const { getBalances, settleUp } = require("../controllers/balanceController");
const authMiddleware = require("../middleware/authMiddleware");

// FIX: /settle/:groupId must be declared BEFORE /:groupId
// otherwise Express matches "settle" as the groupId param and never reaches this route
router.get("/settle/:groupId", authMiddleware, settleUp);
router.get("/:groupId", authMiddleware, getBalances);

module.exports = router;

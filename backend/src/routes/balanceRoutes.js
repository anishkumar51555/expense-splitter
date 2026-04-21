const express = require("express");
const router = express.Router();
const { getBalances, settleUp } = require("../controllers/balanceController");
const authMiddleware = require("../middleware/authMiddleware");


router.get("/:groupId", authMiddleware, getBalances);
router.get("/settle/:groupId", authMiddleware, settleUp);

module.exports = router;
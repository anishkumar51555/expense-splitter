const express = require("express");
const router = express.Router();

const {
  createGroup,
  getGroups,
  addMember,
  getGroupDetails,
  joinByInvite,
  leaveGroup,
  getHistory,
} = require("../controllers/groupController");

const authMiddleware = require("../middleware/authMiddleware");

router.post("/create", authMiddleware, createGroup);
router.get("/", authMiddleware, getGroups);
router.post("/add-member", authMiddleware, addMember);

// 🔥 FIXED ROUTES
router.get("/join/:code", authMiddleware, joinByInvite);
router.post("/leave/:id", authMiddleware, leaveGroup);

// 🔥 ALWAYS LAST
router.get("/history", authMiddleware, getHistory);
router.get("/:id", authMiddleware, getGroupDetails);


module.exports = router;
const express = require("express");
const router = express.Router();

const {
  addExpense,
  getExpense,
  markPaid,
} = require("../controllers/expenseController");

const authMiddleware = require("../middleware/authMiddleware");

router.post("/add", authMiddleware, addExpense);

router.get("/:id", authMiddleware, getExpense);
router.post("/mark-paid", authMiddleware, markPaid);

module.exports = router;
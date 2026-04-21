const express = require("express");
const router = express.Router();

const {
  addExpense,
  payExpense,
} = require("../controllers/expenseController");

const authMiddleware = require("../middleware/authMiddleware");

router.post("/add", authMiddleware, addExpense);
router.post("/pay", authMiddleware, payExpense);

module.exports = router;
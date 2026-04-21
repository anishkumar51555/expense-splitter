const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const {
  savePayment,
  getMyPayment,
} = require("../controllers/userController");

router.post("/payment", auth, savePayment);
router.get("/payment", auth, getMyPayment);

module.exports = router;
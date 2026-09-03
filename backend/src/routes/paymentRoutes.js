const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const {
  getConfig,
  createOrder,
  verifyPayment,
} = require("../controllers/paymentController");

router.get("/config", getConfig);
router.post("/order", auth, createOrder);
router.post("/verify", auth, verifyPayment);

// NOTE: the Razorpay webhook is mounted in server.js, not here — it needs a raw
// body parser to check its signature, which this router's JSON parsing breaks.

module.exports = router;

const express = require("express");
const router = express.Router();
const {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  verifyResetToken,
  resetPassword,
} = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);

// Email verification
router.post("/verify-email", verifyEmail);
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);

// Password reset
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-token", verifyResetToken);
router.get("/verify-reset-token", verifyResetToken);
router.post("/reset-password", resetPassword);

module.exports = router;

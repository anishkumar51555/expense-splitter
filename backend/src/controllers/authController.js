const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const { createToken, hashToken } = require("../utils/tokens");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../utils/email");

const VERIFY_TTL_MINUTES = 60 * 24; // 24 hours
const RESET_TTL_MINUTES = 60; // 1 hour
const BCRYPT_ROUNDS = 10;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
      paymentSetup: user.paymentSetup,
      isVerified: user.isVerified,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ msg: "All fields are required" });
    }
    if (!EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ msg: "Enter a valid email address" });
    }
    if (password.length < 6) {
      return res.status(400).json({ msg: "Password must be at least 6 characters" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const token = createToken(VERIFY_TTL_MINUTES);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      isVerified: false,
      verificationTokenHash: token.hash,
      verificationExpires: token.expiresAt,
    });

    const delivery = await sendVerificationEmail(user, token.raw);

    res.status(201).json({
      msg: "Account created. Check your email for a verification link.",
      emailSent: delivery.delivered,
      user: { _id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    // Accept the token from a POST body or a GET query, so the emailed link
    // works whether the frontend posts it or hits the API directly.
    const token = req.body?.token || req.query?.token;

    if (!token) {
      return res.status(400).json({ msg: "Verification token is required" });
    }

    const user = await User.findOne({ verificationTokenHash: hashToken(token) }).select(
      "+verificationTokenHash +verificationExpires"
    );

    if (!user) {
      return res
        .status(400)
        .json({ msg: "This verification link is invalid or has already been used" });
    }

    if (user.verificationExpires && user.verificationExpires < new Date()) {
      return res
        .status(400)
        .json({ msg: "This verification link has expired. Request a new one." });
    }

    user.isVerified = true;
    user.verificationTokenHash = null;
    user.verificationExpires = null;
    await user.save();

    // Log them straight in once they have proven they own the address.
    res.json({
      msg: "Email verified successfully",
      token: signToken(user),
    });
  } catch (error) {
    console.error("VERIFY EMAIL ERROR:", error);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: "Email is required" });

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    // Same reply whether or not the address exists, so this cannot be used to
    // work out which emails are registered.
    const genericReply = {
      msg: "If that address needs verifying, a new link is on its way.",
    };

    if (!user || user.isVerified) return res.json(genericReply);

    const token = createToken(VERIFY_TTL_MINUTES);
    user.verificationTokenHash = token.hash;
    user.verificationExpires = token.expiresAt;
    await user.save();

    await sendVerificationEmail(user, token.raw);
    res.json(genericReply);
  } catch (error) {
    console.error("RESEND VERIFICATION ERROR:", error);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    // password is select:false on the schema, so ask for it explicitly.
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+password");
    if (!user) {
      return res.status(400).json({ msg: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid email or password" });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        msg: "Please verify your email before logging in. Check your inbox for the link.",
        needsVerification: true,
        email: user.email,
      });
    }

    res.json({ msg: "Login successful", token: signToken(user) });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: "Email is required" });

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    // Always the same answer, so this cannot be used to enumerate accounts.
    const genericReply = {
      msg: "If an account exists for that address, a reset link has been sent.",
    };

    if (!user) return res.json(genericReply);

    const token = createToken(RESET_TTL_MINUTES);
    user.resetTokenHash = token.hash;
    user.resetExpires = token.expiresAt;
    await user.save();

    await sendPasswordResetEmail(user, token.raw);
    res.json(genericReply);
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);
    res.status(500).json({ msg: "Server error" });
  }
};

/**
 * Confirm a reset token is still good, so the UI can show the form (or an
 * expired-link message) before the user types a new password.
 */
exports.verifyResetToken = async (req, res) => {
  try {
    const token = req.body?.token || req.query?.token;
    if (!token) return res.status(400).json({ msg: "Token is required" });

    const user = await User.findOne({
      resetTokenHash: hashToken(token),
      resetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ valid: false, msg: "This reset link is invalid or has expired" });
    }

    res.json({ valid: true, email: user.email });
  } catch (error) {
    console.error("VERIFY RESET TOKEN ERROR:", error);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ msg: "Reset token and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ msg: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({
      resetTokenHash: hashToken(token),
      resetExpires: { $gt: new Date() },
    }).select("+password +resetTokenHash +resetExpires");

    if (!user) {
      return res.status(400).json({ msg: "This reset link is invalid or has expired" });
    }

    user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Burn the token so the link cannot be replayed.
    user.resetTokenHash = null;
    user.resetExpires = null;

    // Completing a reset proves control of the mailbox.
    if (!user.isVerified) {
      user.isVerified = true;
      user.verificationTokenHash = null;
      user.verificationExpires = null;
    }

    await user.save();

    res.json({ msg: "Password reset successfully. You can now log in." });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    res.status(500).json({ msg: "Server error" });
  }
};

const jwt = require("jsonwebtoken");
const User = require("../models/User");

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

const savePayment = async (req, res) => {
  try {
    const { upiId, qrCode, phone } = req.body;

    if (!upiId && !qrCode && !phone) {
      return res.status(400).json({ msg: "At least one payment detail is required" });
    }

    if (phone && !/^\d{10}$/.test(String(phone).trim())) {
      return res.status(400).json({ msg: "Enter a valid 10-digit phone number" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    user.payment = {
      upiId: upiId?.trim() || user.payment?.upiId || "",
      qrCode: qrCode || user.payment?.qrCode || "",
      phone: phone?.trim() || user.payment?.phone || "",
    };

    // Mark payment setup as done
    user.paymentSetup = true;

    await user.save();

    // Hand back a refreshed token: the old one still says paymentSetup:false and
    // would send the user back through setup on their next login.
    res.json({
      msg: "Payment details saved",
      payment: user.payment,
      token: signToken(user),
    });
  } catch (err) {
    console.error("SAVE PAYMENT ERROR:", err);
    res.status(500).json({ msg: "Error saving payment" });
  }
};

const getMyPayment = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("payment paymentSetup");
    if (!user) return res.status(404).json({ msg: "User not found" });

    res.json({ payment: user.payment || {}, paymentSetup: user.paymentSetup || false });
  } catch (err) {
    console.error("GET PAYMENT ERROR:", err);
    res.status(500).json({ msg: "Error fetching payment" });
  }
};

module.exports = { savePayment, getMyPayment };

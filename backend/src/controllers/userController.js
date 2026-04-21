const User = require("../models/User");

// SAVE PAYMENT DETAILS
const savePayment = async (req, res) => {
  try {
    const { upiId, qrCode } = req.body;

    if (!upiId && !qrCode) {
      return res.status(400).json({ msg: "At least UPI ID or QR code is required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    user.payment = {
      upiId: upiId?.trim() || user.payment?.upiId || "",
      qrCode: qrCode || user.payment?.qrCode || "",
    };

    await user.save();

    res.json({ msg: "Payment details saved", payment: user.payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error saving payment" });
  }
};

// GET MY PAYMENT DETAILS
const getMyPayment = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("payment");
    if (!user) return res.status(404).json({ msg: "User not found" });

    res.json(user.payment || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error fetching payment" });
  }
};

module.exports = { savePayment, getMyPayment };

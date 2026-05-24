const User = require("../models/User");

const savePayment = async (req, res) => {
  try {
    const { upiId, qrCode, phone } = req.body;

    if (!upiId && !qrCode && !phone) {
      return res.status(400).json({ msg: "At least one payment detail is required" });
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

    res.json({ msg: "Payment details saved", payment: user.payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error saving payment" });
  }
};

const getMyPayment = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("payment paymentSetup");
    if (!user) return res.status(404).json({ msg: "User not found" });

    res.json({ payment: user.payment || {}, paymentSetup: user.paymentSetup || false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error fetching payment" });
  }
};

module.exports = { savePayment, getMyPayment };
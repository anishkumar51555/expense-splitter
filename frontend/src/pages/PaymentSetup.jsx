import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";

function PaymentSetup() {
  const [upi, setUpi] = useState("");
  const [phone, setPhone] = useState("");
  const [qr, setQr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleQrUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setQr(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setError("");

    if (!upi.trim() && !phone.trim() && !qr) {
      return setError("Please fill at least one payment detail to continue");
    }

    if (phone && !/^\d{10}$/.test(phone.trim())) {
      return setError("Enter a valid 10-digit phone number");
    }

    setSaving(true);
    try {
      await API.post("/user/payment", { upiId: upi, phone, qrCode: qr });

      // Update token so paymentSetup = true on next decode
      // Fetch fresh token by re-logging — instead, just flag in localStorage
      localStorage.setItem("paymentSetup", "true");

      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.msg || "Error saving. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("paymentSetup", "true");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-transparent ...">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">

        <div className="text-center mb-6">
          <div className="text-5xl mb-3">💳</div>
          <h1 className="text-2xl font-bold text-gray-800">Payment Setup</h1>
          <p className="text-gray-500 text-sm mt-1">
            Add your payment details so group members can pay you back easily
          </p>
        </div>

        {/* Phone */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <div className="flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-400">
            <span className="px-3 text-gray-500 bg-gray-50 border-r py-3 text-sm">+91</span>
            <input
              type="tel"
              placeholder="10-digit mobile number"
              value={phone}
              maxLength={10}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              className="flex-1 p-3 focus:outline-none text-gray-800"
            />
          </div>
        </div>

        {/* UPI ID */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            UPI ID
          </label>
          <input
            type="text"
            placeholder="yourname@upi"
            value={upi}
            onChange={(e) => setUpi(e.target.value)}
            className="w-full border p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-800"
          />
        </div>

        {/* QR Code */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment QR Code <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleQrUpload}
            className="w-full text-sm text-gray-500"
          />
          {qr && (
            <img src={qr} alt="QR Preview" className="mt-3 w-32 h-32 object-contain border rounded-xl" />
          )}
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-4">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-purple-500 text-white py-3 rounded-xl font-semibold hover:bg-purple-600 transition disabled:opacity-50 mb-3"
        >
          {saving ? "Saving..." : "Save & Continue"}
        </button>

        <button
          onClick={handleSkip}
          className="w-full text-gray-400 text-sm hover:text-gray-600 transition"
        >
          Skip for now
        </button>

      </div>
    </div>
  );
}

export default PaymentSetup;
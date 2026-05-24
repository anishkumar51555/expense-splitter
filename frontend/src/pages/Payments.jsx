import { useEffect, useState } from "react";
import API from "../api/api";

function Payments() {
  const [upi, setUpi] = useState("");
  const [qr, setQr] = useState(null);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchPayment = async () => {
      try {
        const res = await API.get("/user/payment");
        if (res.data?.upiId) setUpi(res.data.upiId);
        if (res.data?.qrCode) setQr(res.data.qrCode);
        if (res.data?.phone) setPhone(res.data.phone);
      } catch (err) {
        console.error("Error loading payment details:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPayment();
  }, []);

  const handleSave = async () => {
    if (!upi.trim() && !phone.trim() && !qr) {
      alert("Please enter at least one payment detail");
      return;
    }
    setSaving(true);
    try {
      await API.post("/user/payment", { upiId: upi, qrCode: qr, phone });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert("Error saving payment details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleQrUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setQr(reader.result);
    reader.readAsDataURL(file);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-bounce">💳</div>
        <p className="text-white">Loading...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">💳 Payment Settings</h1>
        <p className="text-white/50 text-sm mt-1">Your details are shown to group members when they owe you</p>
      </div>

      {/* Form Card */}
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-5 shadow-xl space-y-5 mb-4">

        {/* Phone */}
        <div>
          <label className="block text-white/70 text-sm font-semibold mb-2">📱 Phone Number</label>
          <div className="flex items-center bg-white rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-purple-400">
            <span className="px-4 text-gray-500 bg-gray-50 border-r py-3 font-medium">+91</span>
            <input
              type="tel"
              placeholder="10-digit mobile number"
              value={phone}
              maxLength={10}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              className="flex-1 px-4 py-3 text-gray-800 focus:outline-none bg-white placeholder-gray-400"
            />
          </div>
        </div>

        {/* UPI */}
        <div>
          <label className="block text-white/70 text-sm font-semibold mb-2">💳 UPI ID</label>
          <input
            value={upi}
            onChange={(e) => setUpi(e.target.value)}
            placeholder="yourname@upi"
            className="w-full bg-white text-gray-800 px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder-gray-400"
          />
        </div>

        {/* QR Upload */}
        <div>
          <label className="block text-white/70 text-sm font-semibold mb-2">🔲 Payment QR Code</label>
          <label className="flex items-center gap-3 bg-white/10 border border-white/20 border-dashed rounded-2xl px-4 py-4 cursor-pointer hover:bg-white/20 transition">
            <span className="text-2xl">📁</span>
            <div>
              <p className="text-white font-medium text-sm">
                {qr ? "QR uploaded ✅ — tap to change" : "Tap to upload QR image"}
              </p>
              <p className="text-white/40 text-xs">PNG, JPG supported</p>
            </div>
            <input type="file" accept="image/*" onChange={handleQrUpload} className="hidden" />
          </label>
          {qr && (
            <div className="mt-3 flex items-center gap-3">
              <img src={qr} alt="QR Preview" className="w-20 h-20 object-contain rounded-xl border border-white/20" />
              <button
                onClick={() => setQr(null)}
                className="text-xs text-red-400 hover:text-red-300 transition"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-3.5 rounded-2xl font-bold text-white transition shadow-lg ${
            saved
              ? "bg-green-500 shadow-green-500/30"
              : "bg-purple-500 hover:bg-purple-600 shadow-purple-500/30"
          } disabled:opacity-50`}
        >
          {saving ? "Saving..." : saved ? "✅ Saved!" : "Save Payment Details"}
        </button>
      </div>

      {/* Preview Card */}
      {(upi || phone || qr) && (
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-5 shadow-xl">
          <h2 className="text-white font-bold mb-4">👁️ Preview — How others see you</h2>
          <div className="space-y-3">
            {phone && (
              <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-400/20 rounded-2xl px-4 py-3">
                <span>📱</span>
                <span className="text-blue-300 font-medium">+91 {phone}</span>
              </div>
            )}
            {upi && (
              <div className="flex items-center gap-3 bg-purple-500/10 border border-purple-400/20 rounded-2xl px-4 py-3">
                <span>💳</span>
                <span className="text-purple-300 font-mono font-medium">{upi}</span>
              </div>
            )}
            {qr && (
              <div className="flex flex-col items-center bg-white/5 rounded-2xl p-4">
                <p className="text-white/50 text-xs mb-3 uppercase tracking-wide font-semibold">QR Code</p>
                <img src={qr} alt="QR" className="w-32 h-32 object-contain rounded-xl" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Payments;
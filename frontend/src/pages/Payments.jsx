import { useEffect, useState } from "react";
import API from "../api/api";

function Payments() {
  const [upi, setUpi] = useState("");
  const [qr, setQr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fix #3: load from backend, not localStorage
  useEffect(() => {
    const fetchPayment = async () => {
      try {
        const res = await API.get("/user/payment");
        if (res.data?.upiId) setUpi(res.data.upiId);
        if (res.data?.qrCode) setQr(res.data.qrCode);
      } catch (err) {
        console.error("Error loading payment details:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPayment();
  }, []);

  // Fix #3: save to backend API
  const handleSave = async () => {
    if (!upi.trim() && !qr) {
      alert("Please enter a UPI ID or upload a QR code");
      return;
    }

    setSaving(true);
    try {
      await API.post("/user/payment", { upiId: upi, qrCode: qr });
      alert("Payment details saved successfully ✅");
    } catch (err) {
      alert("Error saving payment details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleQrUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setQr(reader.result);
    };
    reader.readAsDataURL(file);
  };

  if (loading) return <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center"><p>Loading...</p></div>;

  return (
    <div className="min-h-screen bg-gray-100 p-6 pb-20 text-black">
      <h1 className="text-2xl font-bold mb-6">💳 Payment Settings</h1>

      <div className="bg-white p-6 rounded-xl shadow space-y-4">

        <div>
          <label className="block mb-1 font-medium">UPI ID</label>
          <input
            value={upi}
            onChange={(e) => setUpi(e.target.value)}
            placeholder="example@upi"
            className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>

        <div>
          <label className="block mb-2 font-medium">Upload QR Code</label>
          <input type="file" accept="image/*" onChange={handleQrUpload} />
          {qr && <img src={qr} alt="QR" className="mt-4 w-40 border rounded" />}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow mt-6">
        <h2 className="font-bold mb-3">Preview</h2>
        <p className="mb-2">UPI: <span className="font-medium">{upi || "Not set"}</span></p>
        {qr && <img src={qr} alt="QR Preview" className="w-40 border rounded" />}
      </div>
    </div>
  );
}

export default Payments;

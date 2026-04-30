import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import API from "../api/api";

function Pay() {
  const { expenseId, userId } = useParams();
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPayment = async () => {
      try {
        const res = await API.get(`/expenses/${expenseId}`);
        setData(res.data);
      } catch {
        alert("Error loading payment");
      }
    };

    fetchPayment();
  }, []);

  const handlePaid = async () => {
    try {
      await API.post(`/expenses/mark-paid`, {
        expenseId,
        userId,
      });

      alert("Payment marked as paid ✅");
      navigate(-1);
    } catch {
      alert("Error updating payment");
    }
  };

  if (!data) return <p>Loading...</p>;

  const receiver = data.paidBy;

  return (
    <div className="p-6 text-black">
      <h2 className="text-2xl font-bold mb-4">💳 Pay</h2>

      <div className="bg-white p-6 rounded shadow space-y-4">

        <p><b>Pay to:</b> {receiver.email}</p>
        <p><b>UPI:</b> {receiver.payment?.upiId || "Not set"}</p>

        {receiver.payment?.qrCode && (
          <img
            src={receiver.payment.qrCode}
            alt="QR"
            className="w-48"
          />
        )}

        <button
          onClick={handlePaid}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Mark as Paid ✅
        </button>
      </div>
    </div>
  );
}

export default Pay;
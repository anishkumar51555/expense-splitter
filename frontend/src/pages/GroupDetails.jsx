import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../api/api";

function GroupDetails() {
  const { id } = useParams();

  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState(null);

  // ✅ FIX: categories properly defined
  const categories = ["Food", "Travel", "Shopping", "Entertainment", "Others"];

  const fetchData = async () => {
    try {
      const res = await API.get(`/groups/${id}`);
      setGroup(res.data.group);
      setExpenses(res.data.expenses);
      setCurrentUserId(res.data.currentUserId);
    } catch {
      alert("Error loading group");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addExpense = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return alert("Enter valid amount");

    try {
      await API.post("/expenses/add", {
        groupId: id,
        amount: parsed,
        description: category || "Expense",
      });
      setAmount("");
      setCategory("");
      fetchData();
    } catch {
      alert("Error adding expense");
    }
  };

  if (loading || !group)
    return <p className="p-6 text-black">Loading...</p>;

  return (
    <div className="min-h-screen bg-gray-100 p-6 pb-32 text-black">

      {/* HEADER */}
      <h1 className="text-2xl font-bold mb-4">{group.name}</h1>

      {/* ADD EXPENSE */}
      <div className="bg-white p-4 rounded-xl shadow mb-4">

        {/* ✅ CATEGORY BUTTONS */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1 rounded-full text-sm ${
                category === c
                  ? "bg-purple-500 text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* INPUT */}
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="border p-2 rounded w-full mb-3 text-black"
        />

        <button
          onClick={addExpense}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 w-full"
        >
          Add Expense
        </button>
      </div>

      {/* EXPENSE LIST */}
      {expenses.map((e) => {
        const split = e.participants.length
          ? e.amount / e.participants.length
          : 0;

        return (
          <div key={e._id} className="bg-white p-4 mb-4 rounded-xl shadow">

            <div className="flex justify-between">
              <div>
                <p className="font-bold">{e.description}</p>
                <p>₹{e.amount}</p>
                <p className="text-sm text-gray-500">
                  Paid by: {e.paidBy?.email}
                </p>
              </div>

              <p className="text-sm text-gray-600">
                ₹{split.toFixed(2)} / person
              </p>
            </div>

            <div className="mt-3 space-y-2">
              {e.participants.map((p) => {
                const isMe =
                  p.user?._id?.toString() === currentUserId?.toString();

                const isPayer =
                  p.user?._id?.toString() === e.paidBy?._id?.toString();

                return (
                  <div
                    key={p._id}
                    className="flex justify-between items-center"
                  >
                    <span>{p.user?.email}</span>

                    {isPayer ? (
                      <span className="text-green-600">Paid ✓</span>
                    ) : p.paid ? (
                      <span className="text-green-600">Settled</span>
                    ) : isMe ? (
                      <button
                        onClick={() => {
                          const upi = e.paidBy?.payment?.upiId;

                          if (!upi) {
                            alert("User has no payment method");
                            return;
                          }

                          setPaymentData({
                            expenseId: e._id,
                            amount: split,
                            upi,
                            qr: e.paidBy?.payment?.qrCode,
                            to: e.paidBy?.email,
                          });
                        }}
                        className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                      >
                        Pay ₹{split.toFixed(2)}
                      </button>
                    ) : (
                      <span className="text-red-500">
                        Owes ₹{split.toFixed(2)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ✅ PAYMENT SHEET FIXED */}
      {paymentData && (
        <div className="fixed bottom-16 left-0 right-0 bg-white p-5 shadow-2xl border-t rounded-t-2xl z-50">

          <h2 className="text-lg font-bold">
            Pay ₹{paymentData.amount.toFixed(2)}
          </h2>

          <p>To: {paymentData.to}</p>
          <p>UPI: {paymentData.upi}</p>

          {paymentData.qr && (
            <img
              src={paymentData.qr}
              alt="QR"
              className="w-40 mt-3 rounded"
            />
          )}

          <div className="flex gap-3 mt-4">
            <button
  onClick={async () => {
    try {
      await API.post("/expenses/pay", {
        expenseId: paymentData.expenseId,
      });

      // popup close
      setPaymentData(null);

      // 🔥 FIX: delay + refresh
      setTimeout(() => {
        fetchData();
      }, 300);

    } catch (err) {
      alert("Payment update failed");
    }
  }}
  className="bg-green-500 text-white px-4 py-2 rounded w-full"
>
  Mark as Paid
</button>

            <button
              onClick={() => setPaymentData(null)}
              className="bg-gray-300 px-4 py-2 rounded w-full"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupDetails;
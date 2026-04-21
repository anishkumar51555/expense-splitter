import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../api/api";

function GroupDetails() {
  const { id } = useParams();

  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [addingExpense, setAddingExpense] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const fetchData = async () => {
    try {
      const res = await API.get(`/groups/${id}`);
      setGroup(res.data.group);
      setExpenses(res.data.expenses);
      setSettlements(res.data.settlements || []);
      setCurrentUserId(res.data.currentUserId);
    } catch {
      alert("Error loading group details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addExpense = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return alert("Enter a valid amount");

    setAddingExpense(true);
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
    } finally {
      setAddingExpense(false);
    }
  };

  // Fix #19: copy invite link to clipboard
  const copyInviteLink = () => {
    const link = `${window.location.origin}/join/${group.inviteCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    });
  };

  // Fix #4: correct string comparison for balance calculation
  let youOwe = 0;
  let youAreOwed = 0;

  expenses.forEach((e) => {
    const split = e.participants?.length ? e.amount / e.participants.length : 0;

    // Fix #4: use .toString() on both sides for safe ObjectId comparison
    const isPayer = e.paidBy?._id?.toString() === currentUserId?.toString();

    const my = e.participants?.find(
      (p) => p.user?._id?.toString() === currentUserId?.toString()
    );

    if (!my) return;

    if (isPayer) {
      youAreOwed += e.amount - split;
    } else if (!my.paid) {
      youOwe += split;
    }
  });

  if (loading || !group) return <p className="p-6 text-black">Loading...</p>;

  const categories = ["Food", "Travel", "Shopping", "Entertainment", "Others"];

  return (
    <div className="min-h-screen bg-gray-100 p-6 pb-20 text-black">

      {/* HEADER */}
      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{group.name}</h1>
            <p
              className="text-gray-600 cursor-pointer hover:text-purple-600"
              onClick={() => setShowMembers(!showMembers)}
            >
              👥 {group.members?.length} members
            </p>
          </div>

          {/* Fix #19: invite link button */}
          <button
            onClick={copyInviteLink}
            className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-sm hover:bg-purple-200 transition"
          >
            {inviteCopied ? "✅ Copied!" : "🔗 Invite Link"}
          </button>
        </div>

        {showMembers && (
          <div className="mt-3 space-y-2">
            {group.members.map((m) => (
              <div key={m._id} className="bg-gray-50 p-3 rounded">
                <p className="font-medium">{m.name || m.email}</p>
                <p className="text-sm text-gray-500">{m.email}</p>
                {m.payment?.upiId ? (
                  <p className="text-sm text-gray-600">UPI: {m.payment.upiId}</p>
                ) : (
                  <p className="text-sm text-red-400">No UPI set</p>
                )}
                {m.payment?.qrCode && (
                  <img src={m.payment.qrCode} alt="QR" className="w-20 mt-2 rounded" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BALANCE SUMMARY */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-green-100 p-4 rounded-xl text-center">
          <p className="text-gray-600">You are owed</p>
          <h2 className="text-2xl font-bold text-green-700">₹{youAreOwed.toFixed(2)}</h2>
        </div>
        <div className="bg-red-100 p-4 rounded-xl text-center">
          <p className="text-gray-600">You owe</p>
          <h2 className="text-2xl font-bold text-red-700">₹{youOwe.toFixed(2)}</h2>
        </div>
      </div>

      {/* SETTLEMENTS */}
      <div className="bg-white p-4 rounded-xl shadow mb-6">
        <h2 className="font-bold mb-3">Who owes whom</h2>
        {settlements.length === 0 ? (
          <p className="text-green-600">All settled up 🎉</p>
        ) : (
          settlements.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
              <p>
                <span className="font-medium">{s.from}</span>
                <span className="text-gray-500 mx-2">→</span>
                <span className="font-medium">{s.to}</span>
              </p>
              <span className="font-bold text-red-600">₹{s.amount}</span>
            </div>
          ))
        )}
      </div>

      {/* ADD EXPENSE */}
      <div className="bg-white p-4 rounded-xl shadow mb-6">
        <h2 className="font-bold mb-3">Add Expense</h2>
        <div className="flex gap-2 mb-3 flex-wrap">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1 rounded-full text-sm ${
                category === c ? "bg-purple-500 text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (₹)"
            className="border p-2 rounded flex-1 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button
            onClick={addExpense}
            disabled={addingExpense}
            className="bg-purple-500 text-white px-4 rounded hover:bg-purple-600 disabled:opacity-50"
          >
            {addingExpense ? "Adding..." : "Add"}
          </button>
        </div>
      </div>

      {/* EXPENSE LIST */}
      {expenses.length === 0 ? (
        <p className="text-center text-gray-500">No expenses yet. Add one above!</p>
      ) : (
        expenses.map((e) => {
          const split = e.participants?.length ? e.amount / e.participants.length : 0;

          return (
            <div key={e._id} className="bg-white p-4 rounded-xl shadow mb-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold">{e.description}</p>
                  <p className="text-gray-700">₹{e.amount}</p>
                  <p className="text-sm text-gray-500">Paid by: {e.paidBy?.name || e.paidBy?.email}</p>
                </div>
                <div className="text-sm text-gray-500">₹{split.toFixed(2)} / person</div>
              </div>

              <div className="mt-3 space-y-1">
                {e.participants.map((p) => (
                  <div key={p._id} className="flex justify-between text-sm">
                    <span>{p.user?.name || p.user?.email}</span>

                    {/* Fix #4: correct string comparison */}
                    {p.user?._id?.toString() === e.paidBy?._id?.toString() ? (
                      <span className="text-green-600 font-medium">Paid ✓</span>
                    ) : p.paid ? (
                      <span className="text-green-600">Settled</span>
                    ) : p.user?._id?.toString() === currentUserId?.toString() ? (
                      <button
                        onClick={() => {
                          const upi = e.paidBy?.payment?.upiId;
                          if (!upi) {
                            alert("This user has not set a payment method.");
                            return;
                          }
                          alert(`Pay ₹${split.toFixed(2)} to UPI: ${upi}`);
                        }}
                        className="bg-blue-500 text-white px-2 py-0.5 rounded hover:bg-blue-600"
                      >
                        Pay ₹{split.toFixed(2)}
                      </button>
                    ) : (
                      <span className="text-red-500">Owes ₹{split.toFixed(2)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default GroupDetails;

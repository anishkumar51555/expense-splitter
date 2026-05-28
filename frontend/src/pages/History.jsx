import { useEffect, useState } from "react";
import API from "../api/api";

function History() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const res = await API.get("/groups/history");
      setData(res.data);
    } catch (err) {
      console.log(err);
      alert("Error loading history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-bounce">📜</div>
        <p className="text-white">Loading history...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">📜 History</h1>
        <p className="text-white/50 text-sm mt-1">All your transactions in one place</p>
      </div>

      {data.length === 0 ? (
        <div className="text-center mt-24">
          <div className="text-6xl mb-4">🧾</div>
          <p className="text-white text-lg font-semibold">No transactions yet</p>
          <p className="text-white/40 text-sm mt-1">Add expenses in a group to see them here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((item, i) => (
            <div
              key={i}
              className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-4 shadow-xl hover:bg-white/15 transition"
            >
              <div className="flex items-start justify-between gap-3">
                {/* Icon */}
                <div className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center text-xl ${
                  item.type === "expense"
                    ? "bg-blue-500/20 border border-blue-400/20"
                    : "bg-green-500/20 border border-green-400/20"
                }`}>
                  {item.type === "expense" ? "💸" : "✅"}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-bold text-white truncate">{item.description}</p>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${
                      item.type === "expense"
                        ? "bg-blue-500/20 text-blue-300"
                        : "bg-green-500/20 text-green-300"
                    }`}>
                      {item.type === "expense" ? "Expense" : "Settled"}
                    </span>
                  </div>

                  <p className="text-sm text-white/50">
  {item.type === "expense" ? (
    item.isPayer ? (
      <>You paid in <span className="text-purple-300 font-semibold">{item.groupName}</span></>
    ) : (
      <><span className="text-white/70 font-medium">{item.paidBy}</span> paid in <span className="text-purple-300 font-semibold">{item.groupName}</span></>
    )
  ) : (
    item.isSender ? (
      <>You paid <span className="text-green-300 font-semibold">{item.paidTo}</span> in <span className="text-purple-300 font-semibold">{item.groupName}</span></>
    ) : (
      <><span className="text-green-300 font-semibold">{item.paidBy}</span> paid you in <span className="text-purple-300 font-semibold">{item.groupName}</span></>
    )
  )}
</p>

<div className="flex justify-between items-center mt-2">
  <span className={`font-bold text-base ${
    item.type === "payment"
      ? item.isSender ? "text-red-400" : "text-green-400"
      : item.isPayer ? "text-green-400" : "text-red-400"
  }`}>
    {item.type === "payment"
      ? item.isSender ? `-₹${item.amount}` : `+₹${item.amount}`
      : item.isPayer ? `+₹${item.amount}` : `-₹${item.amount}`
    }
  </span>
  <span className="text-white/30 text-xs">
    {new Date(item.time).toLocaleString()}
  </span>
</div>
</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default History;
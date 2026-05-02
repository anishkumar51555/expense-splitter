import { useEffect, useState } from "react";
import API from "../api/api";

function History() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const res = await API.get("/groups/history");

      // FIX: group is now populated by backend, so e.group.name works correctly
      const formatted = res.data.map((e) => ({
        description: e.description,
        amount: e.amount,
        groupName: e.group?.name || "Unknown Group",
        paidBy: e.paidBy?.name || e.paidBy?.email || "Someone",
        time: e.createdAt,
      }));

      setData(formatted);
    } catch (err) {
      console.log(err);
      alert("Error loading history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
      <p>Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6 pb-16 text-gray-800">
      <h1 className="text-2xl font-bold mb-6">📜 Account History</h1>

      {data.length === 0 ? (
        <div className="text-center mt-20">
          <p className="text-gray-500 text-lg">No transactions yet</p>
          <p className="text-gray-400 text-sm">Add expenses in a group to see them here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((item, i) => (
            <div key={i} className="bg-white p-4 rounded-xl shadow hover:shadow-md transition">
              <p className="font-medium">{item.description}</p>
              <p className="text-sm text-gray-500 mt-1">
                {item.paidBy} paid in{" "}
                <span className="font-medium text-purple-600">{item.groupName}</span>
              </p>
              <div className="flex justify-between mt-2 text-sm text-gray-500">
                <span className="font-bold text-gray-800">₹{item.amount}</span>
                <span>{new Date(item.time).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default History;

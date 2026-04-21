import { useEffect, useState } from "react";
import API from "../api/api";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const [groups, setGroups] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const navigate = useNavigate();

  const fetchGroups = async () => {
    try {
      const res = await API.get("/groups");
      setGroups(Array.isArray(res.data) ? res.data : []);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return alert("Enter a group name");

    setCreating(true);
    try {
      await API.post("/groups/create", { name: groupName.trim() });
      setGroupName("");
      setShowModal(false);
      fetchGroups();
    } catch {
      alert("Error creating group. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 p-6 pb-20 relative">

      <div className="absolute top-0 left-0 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute top-0 right-0 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

      <div className="flex justify-between items-center mb-8 relative z-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">💸 Splitwise</h1>
          <p className="text-gray-500 text-sm">Manage your expenses easily</p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
        >
          Logout
        </button>
      </div>

      <div className="mb-6 relative z-10">
        <button
          onClick={() => setShowModal(true)}
          className="bg-purple-500 text-white px-6 py-3 rounded-xl shadow hover:bg-purple-600 transition"
        >
          + New Group
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-center">Loading...</p>
      ) : groups.length === 0 ? (
        <div className="text-center mt-20">
          <img
            src="https://cdn-icons-png.flaticon.com/512/4076/4076549.png"
            alt="empty"
            className="w-32 mx-auto mb-4 opacity-70"
          />
          <p className="text-gray-500 text-lg">No groups yet</p>
          <p className="text-gray-400 text-sm">Create your first group 🚀</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6 relative z-10">
          {groups.map((g) => (
            <div
              key={g._id}
              onClick={() => navigate(`/group/${g._id}`)}
              className="bg-white/80 backdrop-blur p-6 rounded-2xl shadow hover:shadow-xl hover:scale-105 transition cursor-pointer border"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center text-xl">
                  📁
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{g.name}</h3>
                  <p className="text-sm text-gray-500">{g.members?.length} members</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-20">
          <div className="bg-white p-6 rounded-xl w-80 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Create Group</h2>
            <input
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
              className="w-full p-3 border rounded-lg mb-4 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowModal(false); setGroupName(""); }}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={creating}
                className="px-4 py-2 rounded bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;

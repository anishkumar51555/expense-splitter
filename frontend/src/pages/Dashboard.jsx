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

  useEffect(() => { fetchGroups(); }, []);

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return alert("Enter group name");
    setCreating(true);
    try {
      await API.post("/groups/create", { name: groupName.trim() });
      setGroupName("");
      setShowModal(false);
      fetchGroups();
    } catch {
      alert("Error creating group");
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">

      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-5 mb-6 shadow-xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">💸 Splitwise</h1>
            <p className="text-white/50 text-sm">Manage your expenses easily</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-500/20 border border-red-400/30 text-red-400 px-4 py-2 rounded-2xl text-sm font-semibold hover:bg-red-500/30 transition"
          >
            🚪 Logout
          </button>
        </div>
      </div>

      {/* New Group Button */}
      <button
        onClick={() => setShowModal(true)}
        className="w-full bg-purple-500 text-white py-4 rounded-3xl font-bold text-lg hover:bg-purple-600 transition shadow-lg shadow-purple-500/30 mb-6 flex items-center justify-center gap-2"
      >
        <span className="text-xl">+</span> New Group
      </button>

      {/* Groups */}
      {loading ? (
        <div className="text-center mt-20">
          <div className="text-5xl mb-4 animate-bounce">👥</div>
          <p className="text-white/60">Loading groups...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center mt-20">
          <div className="text-6xl mb-4">🗂️</div>
          <p className="text-white text-lg font-semibold">No groups yet</p>
          <p className="text-white/40 text-sm mt-1">Create your first group above 🚀</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <div
              key={g._id}
              onClick={() => navigate(`/group/${g._id}`)}
              className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-5 hover:bg-white/20 hover:scale-105 transition cursor-pointer shadow-xl"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-500/30 border border-purple-400/30 rounded-2xl flex items-center justify-center text-2xl">
                  💰
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{g.name}</h3>
                  <p className="text-white/40 text-sm">👥 {g.members?.length} members</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20 p-4">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-1">Create Group</h2>
            <p className="text-white/40 text-sm mb-5">Give your group a name</p>
            <input
              placeholder="e.g. Goa Trip, Flat Expenses..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
              className="w-full bg-white text-gray-800 px-4 py-3 rounded-2xl mb-4 focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder-gray-400"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowModal(false); setGroupName(""); }}
                className="flex-1 py-3 rounded-2xl border border-white/20 text-white/70 hover:bg-white/10 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={creating}
                className="flex-1 py-3 rounded-2xl bg-purple-500 text-white font-bold hover:bg-purple-600 transition disabled:opacity-50 shadow-lg shadow-purple-500/30"
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
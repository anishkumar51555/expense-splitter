import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function Profile() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    try {
      const decoded = JSON.parse(atob(token.split(".")[1]));
      setUser({
        email: decoded.email || "No Email",
        name: decoded.name || decoded.email?.split("@")[0] || "User",
      });
    } catch (err) {
      console.error("Token decode error:", err);
      navigate("/");
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-700">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 pb-20 text-gray-800">

      <div className="bg-white p-6 rounded-xl shadow mb-6 text-center">
        <div className="w-20 h-20 mx-auto mb-3 bg-purple-500 text-white flex items-center justify-center rounded-full text-3xl font-bold">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-xl font-bold">{user.name}</h2>
        <p className="text-gray-500">{user.email}</p>
      </div>

      <div className="bg-white p-4 rounded-xl shadow space-y-1 text-gray-800">
        <button className="w-full text-left p-3 hover:bg-gray-100 rounded transition">
          ✏️ Edit Profile <span className="text-gray-400 text-sm">(coming soon)</span>
        </button>

        {/* Fix #14: actually navigate to /payments */}
        <button
          onClick={() => navigate("/payments")}
          className="w-full text-left p-3 hover:bg-gray-100 rounded transition"
        >
          💳 Payment Settings
        </button>

        <button
          onClick={handleLogout}
          className="w-full text-left p-3 text-red-600 hover:bg-red-50 rounded transition"
        >
          🚪 Logout
        </button>
      </div>
    </div>
  );
}

export default Profile;

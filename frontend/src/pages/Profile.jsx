import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function Profile() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/"); return; }
    try {
      const decoded = JSON.parse(atob(token.split(".")[1]));
      setUser({
        email: decoded.email || "No Email",
        name: decoded.name || decoded.email?.split("@")[0] || "User",
      });
    } catch {
      navigate("/");
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-bounce">👤</div>
        <p className="text-white">Loading profile...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">

      {/* Avatar Card */}
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 mb-4 text-center shadow-xl">
        <div className="w-24 h-24 mx-auto mb-4 bg-purple-500 text-white flex items-center justify-center rounded-full text-4xl font-bold shadow-lg shadow-purple-500/40">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-2xl font-bold text-white">{user.name}</h2>
        <p className="text-white/50 mt-1">{user.email}</p>
      </div>

      {/* Menu Card */}
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl overflow-hidden shadow-xl">

        <button className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/10 transition border-b border-white/10">
          <div className="w-10 h-10 bg-blue-500/20 rounded-2xl flex items-center justify-center">
            <span className="text-lg">✏️</span>
          </div>
          <div>
            <p className="text-white font-semibold">Edit Profile</p>
            <p className="text-white/40 text-xs">Coming soon</p>
          </div>
        </button>

        <button
          onClick={() => navigate("/payments")}
          className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/10 transition border-b border-white/10"
        >
          <div className="w-10 h-10 bg-purple-500/20 rounded-2xl flex items-center justify-center">
            <span className="text-lg">💳</span>
          </div>
          <div>
            <p className="text-white font-semibold">Payment Settings</p>
            <p className="text-white/40 text-xs">UPI, QR code, Phone</p>
          </div>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-4 p-5 text-left hover:bg-red-500/10 transition"
        >
          <div className="w-10 h-10 bg-red-500/20 rounded-2xl flex items-center justify-center">
            <span className="text-lg">🚪</span>
          </div>
          <div>
            <p className="text-red-400 font-semibold">Logout</p>
            <p className="text-white/40 text-xs">Sign out of your account</p>
          </div>
        </button>

      </div>
    </div>
  );
}

export default Profile;
import { useNavigate, useLocation } from "react-router-dom";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { path: "/history",   icon: "🧾", label: "History"  },
    { path: "/dashboard", icon: "👥", label: "Groups"   },
    { path: "/payments",  icon: "💳", label: "Payments" },
    { path: "/profile",   icon: "👤", label: "Profile"  },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-10 px-4 pb-4">
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl flex justify-around py-3 px-2">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition ${
                active
                  ? "bg-purple-500/30 text-purple-300"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <p className={`text-xs font-semibold ${active ? "text-purple-300" : "text-white/40"}`}>
                {tab.label}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Navbar;
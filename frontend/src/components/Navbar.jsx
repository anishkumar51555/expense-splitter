import { useNavigate, useLocation } from "react-router-dom";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const itemClass = (path) =>
    `flex flex-col items-center cursor-pointer ${
      location.pathname === path ? "text-purple-600" : "text-gray-500"
    }`;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow flex justify-around py-2">

      <div onClick={() => navigate("/history")} className={itemClass("/history")}>
        <span>🧾</span>
        <p className="text-xs">History</p>
      </div>

      <div onClick={() => navigate("/dashboard")} className={itemClass("/dashboard")}>
        <span>👥</span>
        <p className="text-xs">Groups</p>
      </div>

      <div onClick={() => navigate("/payments")} className={itemClass("/payments")}>
        <span>💳</span>
        <p className="text-xs">Payments</p>
      </div>

      <div onClick={() => navigate("/profile")} className={itemClass("/profile")}>
        <span>👤</span>
        <p className="text-xs">Profile</p>
      </div>

    </div>
  );
}

export default Navbar;
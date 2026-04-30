import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import GroupDetails from "./pages/GroupDetails";
import Profile from "./pages/Profile";
import Payments from "./pages/Payments";
import History from "./pages/History";
import JoinGroup from "./pages/JoinGroup";

import Navbar from "./components/Navbar";
import Pay from "./pages/Pay";

// Fix #8: PrivateRoute guards all authenticated pages
function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/" replace />;
}

const hideNavbarRoutes = ["/", "/register"];

function AppContent() {
  const location = useLocation();

  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Fix #9: JoinGroup added as protected route */}
        <Route path="/join/:code" element={<PrivateRoute><JoinGroup /></PrivateRoute>} />

        {/* Protected routes */}
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/group/:id" element={<PrivateRoute><GroupDetails /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/payments" element={<PrivateRoute><Payments /></PrivateRoute>} />
        <Route path="/history" element={<PrivateRoute><History /></PrivateRoute>} />
        <Route path="/pay/:expenseId/:userId" element={<Pay />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {!hideNavbarRoutes.includes(location.pathname) && <Navbar />}
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;

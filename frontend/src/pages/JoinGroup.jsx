import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/api";
import { savePendingInvite, clearPendingInvite } from "../utils/pendingInvite";

function JoinGroup() {
  const { code } = useParams();
  const navigate = useNavigate();
  // FIX: show proper loading/success/error states instead of just a plain text paragraph
  const [status, setStatus] = useState("joining");

  useEffect(() => {
    // Invites are usually opened by someone who is not signed in yet. Park the
    // code so it survives login — and possibly a registration and an email
    // round trip — then send them on to do that.
    if (!localStorage.getItem("token")) {
      savePendingInvite(code);
      setStatus("needsLogin");
      setTimeout(() => navigate("/"), 1800);
      return;
    }

    const join = async () => {
      try {
        const res = await API.get(`/groups/join/${code}`);
        const groupId = res.data.group?._id;
        clearPendingInvite();
        setStatus("success");
        setTimeout(() => {
          if (groupId) navigate(`/group/${groupId}`);
          else navigate("/dashboard");
        }, 1500);
      } catch {
        // A bad code should not follow them around for the rest of the session.
        clearPendingInvite();
        setStatus("error");
      }
    };
    join();
  }, []);

  return (
    <div className="min-h-screen bg-transparent ...">
      <div className="bg-white p-8 rounded-2xl shadow-xl text-center w-80">
        {status === "joining" && (
          <>
            <div className="text-4xl mb-4 animate-bounce">🔗</div>
            <h2 className="text-xl font-bold text-gray-800">Joining group...</h2>
            <p className="text-gray-500 mt-2">Please wait</p>
          </>
        )}
        {status === "needsLogin" && (
          <>
            <div className="text-4xl mb-4">🔐</div>
            <h2 className="text-xl font-bold text-gray-800">Sign in to join</h2>
            <p className="text-gray-500 mt-2">
              We'll add you to the group as soon as you're signed in.
            </p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-green-700">Joined successfully!</h2>
            <p className="text-gray-500 mt-2">Redirecting to group...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-4xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-red-600">Invalid invite link</h2>
            <p className="text-gray-500 mt-2">This link may have expired or is incorrect.</p>
            <button
              onClick={() => navigate("/dashboard")}
              className="mt-4 bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600"
            >
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default JoinGroup;

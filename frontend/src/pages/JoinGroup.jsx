import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/api";

function JoinGroup() {
  const { code } = useParams();
  const navigate = useNavigate();
  // FIX: show proper loading/success/error states instead of just a plain text paragraph
  const [status, setStatus] = useState("joining");

  useEffect(() => {
    const join = async () => {
      try {
        const res = await API.get(`/groups/join/${code}`);
        const groupId = res.data.group?._id;
        setStatus("success");
        setTimeout(() => {
          if (groupId) navigate(`/group/${groupId}`);
          else navigate("/dashboard");
        }, 1500);
      } catch {
        setStatus("error");
      }
    };
    join();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-xl text-center w-80">
        {status === "joining" && (
          <>
            <div className="text-4xl mb-4 animate-bounce">🔗</div>
            <h2 className="text-xl font-bold text-gray-800">Joining group...</h2>
            <p className="text-gray-500 mt-2">Please wait</p>
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

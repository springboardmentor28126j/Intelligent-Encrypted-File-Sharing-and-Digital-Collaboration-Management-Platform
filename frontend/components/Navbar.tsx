"use client";

import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="navbar">
      <div>
        <strong>
          {user?.name || "TrustShare"}
        </strong>
      </div>

      <div className="navbar-user">
        <span>
          {user?.email}
        </span>

        <button
          onClick={logout}
          className="logout-button"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
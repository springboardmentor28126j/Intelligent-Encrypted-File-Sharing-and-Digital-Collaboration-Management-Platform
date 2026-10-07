import { useState } from "react";
import { useRouter } from "next/router";
import api from "../lib/api";

export default function ResetPassword() {
  const router = useRouter();
  const { token } = router.query;

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (!token) {
      setError("Missing or invalid reset token");
      return;
    }

    try {
      const res = await api.post("/auth/reset-password", {
        token,
        new_password: newPassword,
      });
      localStorage.setItem("token", res.data.access_token);
      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 1200);
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong");
    }
  };

  const inputStyle = {
    display: "block",
    width: "100%",
    marginBottom: 12,
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    fontSize: 14,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: "0 16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 36,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Choose a new password</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 0, marginBottom: 24 }}>
          This link expires 15 minutes after it was requested.
        </p>

        {!success && (
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={inputStyle}
            />
            {error && (
              <p style={{ color: "var(--danger)", background: "var(--danger-bg)", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "12px 0",
                background: "var(--forest)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Reset password
            </button>
          </form>
        )}

        {success && (
          <p style={{ fontSize: 14 }}>Password updated. Redirecting you to your dashboard...</p>
        )}

        <p style={{ marginTop: 20, textAlign: "center", fontSize: 14 }}>
          <a href="/" style={{ color: "var(--lime-dark)", textDecoration: "none" }}>
            Back to log in
          </a>
        </p>
      </div>
    </div>
  );
}
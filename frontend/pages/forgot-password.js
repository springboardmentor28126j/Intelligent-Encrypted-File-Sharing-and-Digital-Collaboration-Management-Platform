import { useState } from "react";
import api from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [devResetLink, setDevResetLink] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post("/auth/forgot-password", { email });
      setMessage(res.data.message);
      setSubmitted(true);
      // NOTE: reset_token is only present because no email service is wired
      // up yet in this local dev build. In production this would be emailed
      // to the user instead of shown on screen.
      if (res.data.reset_token) {
        setDevResetLink(`/reset-password?token=${res.data.reset_token}`);
      }
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
      }}
    >
      <div
        style={{
          width: 380,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 36,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Reset your password</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 0, marginBottom: 24 }}>
          Enter your email and we'll send you a reset link.
        </p>

        {!submitted && (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              Send reset link
            </button>
          </form>
        )}

        {submitted && (
          <div>
            <p style={{ fontSize: 14 }}>{message}</p>
            {devResetLink && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 8,
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  fontSize: 13,
                }}
              >
                <div style={{ color: "var(--text-muted)", marginBottom: 6 }}>
                  Dev mode — no email service configured yet, so here's your reset link directly:
                </div>
                <a href={devResetLink} style={{ color: "var(--lime-dark)", wordBreak: "break-all" }}>
                  {devResetLink}
                </a>
              </div>
            )}
          </div>
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

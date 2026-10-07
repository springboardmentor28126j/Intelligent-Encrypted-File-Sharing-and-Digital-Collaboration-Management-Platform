import { useState } from "react";
import { useRouter } from "next/router";
import api from "../lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      let token;
      if (isRegister) {
        const res = await api.post("/auth/register", { email, password });
        token = res.data.access_token;
      } else {
        const form = new URLSearchParams();
        form.append("username", email);
        form.append("password", password);
        const res = await api.post("/auth/login", form, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        token = res.data.access_token;
      }
      localStorage.setItem("token", token);
      router.push("/dashboard");
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--lime)",
              color: "var(--forest)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
            }}
          >
            T
          </div>
          <span style={{ fontWeight: 700, fontSize: 18 }}>TrustShare</span>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>
          {isRegister ? "Create your account" : "Welcome back"}
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 0, marginBottom: 24 }}>
          {isRegister ? "Start sharing files securely." : "Log in to your secure workspace."}
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />

          {!isRegister && (
            <div style={{ textAlign: "right", marginBottom: 16 }}>
              <a href="/forgot-password" style={{ fontSize: 13, color: "var(--lime-dark)", textDecoration: "none" }}>
                Forgot password?
              </a>
            </div>
          )}

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
              marginTop: 4,
            }}
          >
            {isRegister ? "Register" : "Log in"}
          </button>
        </form>

        <p style={{ marginTop: 20, textAlign: "center", fontSize: 14 }}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setIsRegister(!isRegister);
              setError("");
            }}
            style={{ color: "var(--lime-dark)", textDecoration: "none" }}
          >
            {isRegister ? "Already have an account? Log in" : "No account? Register"}
          </a>
        </p>
      </div>
    </div>
  );
}
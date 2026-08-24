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

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>TrustShare</h1>
      <h2>{isRegister ? "Register" : "Login"}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ display: "block", width: "100%", marginBottom: 8, padding: 8 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ display: "block", width: "100%", marginBottom: 8, padding: 8 }}
        />
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" style={{ padding: "8px 16px" }}>
          {isRegister ? "Register" : "Login"}
        </button>
      </form>
      <p style={{ marginTop: 12 }}>
        <a href="#" onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? "Already have an account? Login" : "No account? Register"}
        </a>
      </p>
    </div>
  );
}

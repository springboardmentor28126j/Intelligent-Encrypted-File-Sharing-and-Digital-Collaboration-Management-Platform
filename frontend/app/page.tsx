"use client";

import { useState } from "react";

// Backend URL
const API_URL = "http://127.0.0.1:8000";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const loginURL = `${API_URL}/login`;

      console.log("Connecting to backend:", loginURL);

      const formData = new URLSearchParams();

      formData.append("username", email.trim());
      formData.append("password", password);

      const response = await fetch(loginURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: formData.toString(),
      });

      console.log("Login status:", response.status);

      const data = await response.json();

      console.log("Login response:", data);

      // ==========================================
      // LOGIN FAILED
      // ==========================================

      if (!response.ok) {
        let errorMessage = "Invalid email or password.";

        if (typeof data.detail === "string") {
          errorMessage = data.detail;
        } else if (Array.isArray(data.detail)) {
          errorMessage = data.detail
            .map((item: any) => {
              if (item && item.msg) {
                return item.msg;
              }

              return "Invalid login information.";
            })
            .join(", ");
        }

        setMessage(errorMessage);
        return;
      }

      // ==========================================
      // CHECK ACCESS TOKEN
      // ==========================================

      if (!data.access_token) {
        setMessage(
          "Login successful, but access token was not received."
        );

        return;
      }

      // ==========================================
      // STORE LOGIN INFORMATION
      // ==========================================

      localStorage.setItem(
        "access_token",
        data.access_token
      );

      localStorage.setItem(
        "user_id",
        String(data.user_id)
      );

      localStorage.setItem(
        "user_email",
        data.email || ""
      );

      localStorage.setItem(
        "user_name",
        data.name || ""
      );

      localStorage.setItem(
        "user_role",
        data.role || "user"
      );

      console.log("Login successful.");
      console.log("User ID:", data.user_id);
      console.log("User:", data.name);
      console.log("Role:", data.role);

      // ==========================================
      // GO TO DASHBOARD
      // ==========================================

      window.location.href = "/dashboard";
    } catch (error) {
      console.error("Login connection error:", error);

      setMessage(
        "Cannot connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // FORGOT PASSWORD
  // ==========================================

  const handleForgotPassword = () => {
    window.location.href = "/forgot-password";
  };

  // ==========================================
  // CREATE ACCOUNT
  // ==========================================

  const handleRegister = () => {
    window.location.href = "/register";
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 px-4">

      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl">

        {/* Project Name */}

        <h1 className="text-4xl font-extrabold text-center text-black mb-3">
          Trust Share
        </h1>

        {/* Login Heading */}

        <h2 className="text-2xl font-bold text-center text-black mb-3">
          Login to your account
        </h2>

        {/* Description */}

        <p className="text-center text-gray-600 mb-8">
          Securely access your files
        </p>

        {/* Login Form */}

        <form onSubmit={handleLogin}>

          {/* Email */}

          <div className="mb-5">

            <label
              htmlFor="email"
              className="block mb-2 font-semibold text-gray-700"
            >
              Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="Enter your email"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-black bg-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-black"
              required
            />

          </div>

          {/* Password */}

          <div className="mb-3">

            <label
              htmlFor="password"
              className="block mb-2 font-semibold text-gray-700"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Enter your password"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-black bg-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-black"
              required
            />

          </div>

          {/* Forgot Password */}

          <div className="text-right mb-6">

            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm font-semibold text-black underline hover:text-gray-600"
            >
              Forgot Password?
            </button>

          </div>

          {/* Login Button */}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition disabled:opacity-50"
          >
            {loading
              ? "Logging in..."
              : "Login"}
          </button>

        </form>

        {/* Message */}

        {message && (
          <p className="text-center mt-5 font-semibold text-black">
            {message}
          </p>
        )}

        {/* Create Account */}

        <div className="text-center mt-7 pt-5 border-t border-gray-200">

          <p className="text-gray-600 mb-2">
            Don't have an account?
          </p>

          <button
            type="button"
            onClick={handleRegister}
            className="font-bold text-black underline hover:text-gray-600"
          >
            Create an Account
          </button>

        </div>

      </div>

    </main>
  );
}
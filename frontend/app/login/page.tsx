"use client";

import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/login?email=${encodeURIComponent(
          email
        )}&password=${encodeURIComponent(password)}`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (response.ok && data.message === "Login successful") {
        // Remove old login information
        localStorage.removeItem("userRole");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userName");

        // Get fresh role from backend
        const role =
          typeof data.role === "string"
            ? data.role.trim().toLowerCase()
            : "";

        const userEmail =
          typeof data.email === "string"
            ? data.email.trim()
            : "";

        const userName =
          typeof data.name === "string"
            ? data.name.trim()
            : "";

        // Validate role received from backend
        const allowedRoles = [
          "user",
          "content_creator",
          "administrator",
        ];

        if (!allowedRoles.includes(role)) {
          alert("Invalid user role received from backend.");
          return;
        }

        if (!userEmail) {
          alert("User email not received from backend.");
          return;
        }

        // Save fresh login information
        localStorage.setItem("userRole", role);
        localStorage.setItem("userEmail", userEmail);
        localStorage.setItem("userName", userName);

        // Show role also, so we can confirm administrator login
        alert(
          `Login successful!\n\nWelcome ${userName}\nRole: ${role}`
        );

        window.location.href = "/dashboard";
      } else {
        alert(data.message || "Invalid email or password");
      }
    } catch (error) {
      console.error("Login error:", error);

      alert(
        "Backend is not connected. Please start FastAPI."
      );
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">

        {/* Project Title */}
        <h1 className="text-3xl font-bold text-blue-600 text-center">
          TrustShare
        </h1>

        <p className="text-center text-gray-600 mt-2">
          Secure File-Sharing Platform
        </p>

        {/* Login Heading */}
        <h2 className="text-2xl font-semibold mt-8 mb-5">
          Login
        </h2>

        {/* Email */}
        <input
          type="email"
          placeholder="Enter email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg px-4 py-3 mb-4"
        />

        {/* Password */}
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-lg px-4 py-3 mb-2"
        />

        {/* Forgot Password */}
        <div className="text-right mb-5">
          <a
            href="/forgot-password"
            className="text-blue-600 text-sm font-semibold hover:underline"
          >
            Forgot Password?
          </a>
        </div>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
        >
          Login
        </button>

        {/* Register */}
        <p className="text-center text-gray-600 mt-5">
          Don't have an account?{" "}
          <a
            href="/register"
            className="text-blue-600 font-semibold"
          >
            Register
          </a>
        </p>

      </div>
    </main>
  );
}
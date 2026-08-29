"use client";

import { useState } from "react";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    setMessage("Creating account...");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name,
            email: email,
            password: password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail || "Registration failed"
        );
        return;
      }

      setMessage(
        "Account created successfully!"
      );

      setName("");
      setEmail("");
      setPassword("");

    } catch (error) {
      console.error(
        "Registration error:",
        error
      );

      setMessage(
        "Cannot connect to the backend."
      );
    }
  };

  const handleLogin = () => {
    window.location.href = "/";
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 px-4">

      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl">

        {/* Project Name */}
        <h1 className="text-4xl font-extrabold text-center mb-3 text-black">
          Intelligent File Sharing
        </h1>

        {/* Subtitle */}
        <p className="text-center text-gray-600 mb-8">
          Create your account
        </p>

        {/* Registration Form */}
        <form onSubmit={handleRegister}>

          {/* Name */}
          <div className="mb-5">
            <label className="block mb-2 font-semibold text-gray-700">
              Name
            </label>

            <input
              type="text"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              placeholder="Enter your name"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 outline-none focus:ring-2 focus:ring-black"
              required
            />
          </div>

          {/* Email */}
          <div className="mb-5">
            <label className="block mb-2 font-semibold text-gray-700">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="Enter your email"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 outline-none focus:ring-2 focus:ring-black"
              required
            />
          </div>

          {/* Password */}
          <div className="mb-6">
            <label className="block mb-2 font-semibold text-gray-700">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Create a password"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 outline-none focus:ring-2 focus:ring-black"
              required
            />
          </div>

          {/* Create Account Button */}
          <button
            type="submit"
            className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
          >
            Create Account
          </button>

        </form>

        {/* Message */}
        {message && (
          <p className="text-center mt-5 font-medium text-black">
            {message}
          </p>
        )}

        {/* Back to Login */}
        <div className="text-center mt-7 pt-5 border-t border-gray-200">

          <p className="text-gray-600">
            Already have an account?
          </p>

          <button
            type="button"
            onClick={handleLogin}
            className="mt-2 font-bold text-black underline hover:text-gray-600"
          >
            Back to Login
          </button>

        </div>

      </div>

    </main>
  );
}
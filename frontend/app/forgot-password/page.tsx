"use client";

import { useState } from "react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/auth/forgot-password",
        {
          method: "POST",

          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email: email.trim(),
          }),
        }
      );

      const data = await response.json();

      console.log(
        "Forgot password status:",
        response.status
      );

      console.log(
        "Forgot password response:",
        data
      );

      // Backend error
      if (!response.ok) {
        setMessage(
          data.detail ||
            "Unable to send reset link."
        );
        return;
      }

      // Email is NOT registered
      if (data.success === false) {
        setMessage(
          "Email address is not registered."
        );
        return;
      }

      // Email is registered
      if (data.success === true) {
        setMessage(
          "Password reset link generated successfully!"
        );

        // Show reset link in browser console
        console.log(
          "Reset link:",
          data.reset_link
        );

        return;
      }

      // Fallback
      setMessage(
        "Unable to process the request."
      );

    } catch (error) {
      console.error(
        "Forgot password error:",
        error
      );

      setMessage(
        "Cannot connect to the backend."
      );

    } finally {
      setLoading(false);
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
          Trust Share
        </h1>

        {/* Heading */}
        <h2 className="text-2xl font-bold text-center text-black mb-3">
          Forgot Password?
        </h2>

        {/* Description */}
        <p className="text-center text-gray-600 mb-8">
          Enter your registered email address to
          receive a password reset link.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit}>

          {/* Email */}
          <div className="mb-6">

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
              placeholder="Enter your registered email"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 bg-white outline-none focus:ring-2 focus:ring-black"
              required
            />

          </div>

          {/* Send Reset Link */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition disabled:opacity-50"
          >
            {loading
              ? "Sending..."
              : "Send Reset Link"}
          </button>

        </form>

        {/* Message */}
        {message && (
          <div className="mt-5 text-center">

            <p className="font-semibold text-black">
              {message}
            </p>

          </div>
        )}

        {/* Back to Login */}
        <div className="text-center mt-7 pt-5 border-t border-gray-200">

          <button
            type="button"
            onClick={handleLogin}
            className="font-bold text-black underline hover:text-gray-600"
          >
            Back to Login
          </button>

        </div>

      </div>

    </main>
  );
}
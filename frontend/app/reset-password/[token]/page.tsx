"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function ResetPassword() {
  const params = useParams();
  const router = useRouter();

  const token = params.token as string;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    setMessage("");

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/auth/reset-password",
        {
          method: "POST",

          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            token: token,
            new_password: password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail || "Unable to reset password."
        );
        return;
      }

      setMessage(
        data.message || "Password reset successfully."
      );

      setPassword("");
      setConfirmPassword("");

    } catch (error) {
      console.error("Reset password error:", error);

      setMessage(
        "Cannot connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    router.push("/");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 px-4">

      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl">

        {/* Project Name */}
        <h1 className="text-4xl font-extrabold text-center mb-3 text-black">
          Intelligent File Sharing
        </h1>

        {/* Heading */}
        <h2 className="text-2xl font-bold text-center text-black mb-3">
          Reset Password
        </h2>

        {/* Description */}
        <p className="text-center text-gray-600 mb-8">
          Enter your new password below.
        </p>

        <form onSubmit={handleReset}>

          {/* New Password */}
          <div className="mb-5">

            <label
              htmlFor="password"
              className="block mb-2 font-semibold text-gray-700"
            >
              New Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Enter new password"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 bg-white outline-none focus:ring-2 focus:ring-black"
              required
            />

          </div>

          {/* Confirm Password */}
          <div className="mb-6">

            <label
              htmlFor="confirmPassword"
              className="block mb-2 font-semibold text-gray-700"
            >
              Confirm Password
            </label>

            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
              placeholder="Confirm new password"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 bg-white outline-none focus:ring-2 focus:ring-black"
              required
            />

          </div>

          {/* Reset Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition disabled:opacity-50"
          >
            {loading
              ? "Resetting..."
              : "Reset Password"}
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

          <button
            type="button"
            onClick={goToLogin}
            className="font-bold text-black underline hover:text-gray-600"
          >
            Back to Login
          </button>

        </div>

      </div>

    </main>
  );
}
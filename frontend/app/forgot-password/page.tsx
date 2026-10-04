"use client";

import { useState } from "react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [step, setStep] = useState(1);
  const [message, setMessage] = useState("");

  const handleSendOTP = async () => {
    if (!email) {
      alert("Please enter your registered email");
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/forgot-password?email=${encodeURIComponent(
          email
        )}`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || "OTP sent successfully");
        setStep(2);
      } else {
        alert(data.message || "Unable to send OTP");
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      alert("Backend is not connected. Please start FastAPI.");
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      alert("Please enter OTP");
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/verify-otp?email=${encodeURIComponent(
          email
        )}&otp=${encodeURIComponent(otp)}`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || "OTP verified successfully");
        setStep(3);
      } else {
        alert(data.message || "Invalid OTP");
      }
    } catch (error) {
      console.error("OTP verification error:", error);
      alert("Backend is not connected. Please start FastAPI.");
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      alert("Please enter both password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email,
            otp: otp,
            new_password: newPassword,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert("Password reset successful. Please login again.");
        window.location.href = "/login";
      } else {
        alert(data.message || "Unable to reset password");
      }
    } catch (error) {
      console.error("Password reset error:", error);
      alert("Backend is not connected. Please start FastAPI.");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">

        <h1 className="text-3xl font-bold text-blue-600 text-center">
          TrustShare
        </h1>

        <p className="text-center text-gray-600 mt-2">
          Secure File-Sharing Platform
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-5">
          Forgot Password
        </h2>

        {/* STEP 1 - EMAIL */}
        {step === 1 && (
          <>
            <p className="text-gray-600 mb-4">
              Enter your registered email address to receive an OTP.
            </p>

            <input
              type="email"
              placeholder="Enter registered email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg px-4 py-3 mb-4"
            />

            <button
              onClick={handleSendOTP}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
            >
              Send OTP
            </button>
          </>
        )}

        {/* STEP 2 - OTP */}
        {step === 2 && (
          <>
            <p className="text-gray-600 mb-4">
              Enter the OTP sent to your email.
            </p>

            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full border rounded-lg px-4 py-3 mb-4"
            />

            <button
              onClick={handleVerifyOTP}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
            >
              Verify OTP
            </button>
          </>
        )}

        {/* STEP 3 - NEW PASSWORD */}
        {step === 3 && (
          <>
            <p className="text-gray-600 mb-4">
              Create your new password.
            </p>

            <input
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border rounded-lg px-4 py-3 mb-4"
            />

            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border rounded-lg px-4 py-3 mb-5"
            />

            <button
              onClick={handleResetPassword}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
            >
              Reset Password
            </button>
          </>
        )}

        {message && (
          <p className="text-green-600 text-center mt-4">
            {message}
          </p>
        )}

        <p className="text-center text-gray-600 mt-6">
          Remember your password?{" "}
          <a
            href="/login"
            className="text-blue-600 font-semibold"
          >
            Login
          </a>
        </p>

      </div>
    </main>
  );
}
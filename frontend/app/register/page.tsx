"use client";

import { useState } from "react";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      // FastAPI /register expects
      // name, email and password as query parameters.
      const params = new URLSearchParams({
        name: name.trim(),
        email: email.trim(),
        password: password,
      });

      const response = await fetch(
        `http://127.0.0.1:8000/register?${params.toString()}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        let errorMessage = "Registration failed.";

        if (Array.isArray(data.detail)) {
          errorMessage = data.detail
            .map((error: any) => {
              return error.msg || "Invalid field";
            })
            .join(", ");
        } else if (
          typeof data.detail === "string"
        ) {
          errorMessage = data.detail;
        }

        setMessage(errorMessage);
        return;
      }

      setMessage(
        "Account created successfully!"
      );

      // Clear form
      setName("");
      setEmail("");
      setPassword("");

      // Return to Login
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);

    } catch (error) {
      console.error(
        "Registration error:",
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
          Create Account
        </h2>

        {/* Description */}
        <p className="text-center text-gray-600 mb-8">
          Create your account to securely manage
          your files.
        </p>

        {/* Registration Form */}
        <form onSubmit={handleRegister}>

          {/* Name */}
          <div className="mb-5">

            <label
              htmlFor="name"
              className="block mb-2 font-semibold text-gray-700"
            >
              Name
            </label>

            <input
              id="name"
              name="name"
              type="text"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              placeholder="Enter your name"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 bg-white outline-none focus:ring-2 focus:ring-black"
              required
            />

          </div>

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
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 bg-white outline-none focus:ring-2 focus:ring-black"
              required
            />

          </div>

          {/* Password */}
          <div className="mb-6">

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
              placeholder="Create a password"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-black placeholder-gray-400 bg-white outline-none focus:ring-2 focus:ring-black"
              required
            />

          </div>

          {/* Create Account Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition disabled:opacity-50"
          >
            {loading
              ? "Creating Account..."
              : "Create Account"}
          </button>

        </form>

        {/* Message */}
        {message && (
          <p className="text-center mt-5 font-semibold text-black">
            {message}
          </p>
        )}

        {/* Back to Login */}
        <div className="text-center mt-7 pt-5 border-t border-gray-200">

          <p className="text-gray-600 mb-2">
            Already have an account?
          </p>

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
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const router = useRouter();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      alert("Please fill all fields");
      return;
    }

    try {
      const response = await fetch("http://localhost:8000/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          role: "user",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Registration successful!");
        router.push("/login");
      } else {
        alert(data.message || "Already Registered");
      }
    } catch (error) {
      alert("Backend is not connected. Please start FastAPI.");
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg">

        <h1 className="text-3xl font-bold text-blue-600 text-center mb-2">
          TrustShare
        </h1>

        <p className="text-center text-gray-600 mb-8">
          Create your account
        </p>

        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-lg p-3 mb-4"
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg p-3 mb-4"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-lg p-3 mb-6"
        />

        <button
          onClick={handleRegister}
          className="w-full bg-blue-600 text-white py-3 rounded-lg"
        >
          Register
        </button>

        <p className="text-center text-gray-500 text-sm mt-6">
          Already registered?
        </p>

        <Link
          href="/login"
          className="block text-center text-blue-600 font-semibold mt-2"
        >
          Login here
        </Link>

      </div>
    </main>
  );
}
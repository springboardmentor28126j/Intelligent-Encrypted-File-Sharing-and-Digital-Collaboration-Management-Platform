"use client";

import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    window.location.replace("/register");
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
        <h1 className="text-3xl font-bold text-blue-600 mb-3">
          TrustShare
        </h1>

        <p className="text-gray-600">
          Loading TrustShare...
        </p>
      </div>
    </main>
  );
}
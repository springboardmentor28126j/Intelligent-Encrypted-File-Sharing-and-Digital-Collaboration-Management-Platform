"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyMFAPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>TrustShare</h1>
        <p>Redirecting to secure login…</p>
      </div>
    </main>
  );
}
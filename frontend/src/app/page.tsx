import React from 'react';
import { Shield, Lock, Share2, Activity, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="space-y-16 py-8">
      <div className="text-center max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-xs font-semibold">
          <Shield className="w-3.5 h-3.5" />
          <span>Server-Side AES-256 Authenticated Encryption</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
          Intelligent Encrypted File Sharing & Digital Collaboration
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed">
          TrustShare protects sensitive enterprise documents with unique per-file AES-256 keys, expiring share links, granular permission control, and immutable audit logs.
        </p>
        <div className="flex justify-center space-x-4">
          <a
            href="/register"
            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-md flex items-center space-x-2"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="/files"
            className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50"
          >
            Launch File Manager
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Per-File AES-256-GCM</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Every upload generates a unique symmetric encryption key. Files are encrypted before cloud storage with zero plaintext on disk.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Share2 className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Controlled Expiring Links</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Share documents with custom TTL expiration, view-only watermarked modes, passphrase protection, and instant revocation.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Immutable Auditability</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Every access, preview, download, and permission change is recorded in structured MongoDB audit logs with real-time anomaly alerts.
          </p>
        </div>
      </div>
    </div>
  );
}

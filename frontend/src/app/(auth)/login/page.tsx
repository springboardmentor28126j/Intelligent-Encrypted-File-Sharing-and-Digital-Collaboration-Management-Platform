'use client';
import React, { useState } from 'react';
import { Lock, Mail, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { setSession } from '@/lib/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/auth/login', {
        email,
        password,
        mfa_code: mfaCode || undefined,
      });

      const token = res.data.access_token;
      let userData = {
        id: res.data.user_id,
        email: res.data.email,
        full_name: email.split('@')[0],
        role: res.data.role,
        mfa_enabled: false,
        storage_quota_bytes: 10737418240,
        storage_used_bytes: 0,
      };

      try {
        const userRes = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (userRes.data) {
          userData = userRes.data;
        }
      } catch {
        // Fallback to token payload data
      }

      setSession(token, userData);
      window.location.href = '/files';
    } catch (err: any) {
      if (err.response?.data?.detail === 'MFA code required') {
        setRequiresMfa(true);
      } else {
        setError(extractErrorMessage(err, 'Authentication failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Sign in to TrustShare</h1>
        <p className="text-xs text-slate-500 mt-1">Access your encrypted documents & collaboration workspaces</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="you@company.com"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>
        </div>

        {requiresMfa && (
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">TOTP MFA Code</label>
            <input
              type="text"
              required
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="6-digit authenticator code"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{requiresMfa ? 'Verify & Sign In' : 'Sign In'}</span>
        </button>
      </form>

      <p className="text-center text-xs text-slate-500 mt-6">
        Don&apos;t have an account?{' '}
        <a href="/register" className="text-indigo-600 font-semibold hover:underline">
          Create an account
        </a>
      </p>
    </div>
  );
}

import './globals.css';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'TrustShare - Encrypted Digital Collaboration',
  description: 'Enterprise server-side encrypted file sharing and digital collaboration management platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
        <header className="border-b border-slate-200 bg-white sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                T
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-800">
                TrustShare
              </span>
            </div>
            <nav className="flex items-center space-x-6">
              <a href="/files" className="text-sm font-medium text-slate-600 hover:text-indigo-600">
                Files
              </a>
              <a href="/admin" className="text-sm font-medium text-slate-600 hover:text-indigo-600">
                Dashboard
              </a>
              <a href="/login" className="text-sm font-medium px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">
                Sign In
              </a>
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </body>
    </html>
  );
}

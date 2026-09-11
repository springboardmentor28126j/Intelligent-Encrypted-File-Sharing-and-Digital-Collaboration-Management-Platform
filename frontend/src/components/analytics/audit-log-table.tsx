'use client';
import React from 'react';
import { Shield, Clock, User, ArrowUpRight } from 'lucide-react';

interface AuditLogItem {
  event_id: string;
  timestamp: string;
  category: string;
  action: string;
  status: string;
  actor: { email?: string; client_ip?: string };
}

export const AuditLogTable: React.FC<{ logs: AuditLogItem[] }> = ({ logs }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-900 text-sm">Immutable Audit Trail (MongoDB)</h3>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
            <tr>
              <th className="p-3">Timestamp</th>
              <th className="p-3">Category</th>
              <th className="p-3">Action</th>
              <th className="p-3">Actor / IP</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => (
              <tr key={log.event_id} className="hover:bg-slate-50">
                <td className="p-3 text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                <td className="p-3 font-semibold text-slate-700">{log.category}</td>
                <td className="p-3 font-mono text-indigo-600">{log.action}</td>
                <td className="p-3">{log.actor?.email || log.actor?.client_ip || 'Anonymous'}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {log.status}
                  </span>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  No audit log events recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

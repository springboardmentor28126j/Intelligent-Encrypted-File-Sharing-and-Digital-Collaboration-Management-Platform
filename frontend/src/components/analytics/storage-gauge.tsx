'use client';
import React from 'react';
import { HardDrive } from 'lucide-react';

interface StorageGaugeProps {
  usedBytes: number;
  quotaBytes: number;
}

export const StorageGauge: React.FC<StorageGaugeProps> = ({ usedBytes, quotaBytes }) => {
  const percentage = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;
  const usedMB = (usedBytes / 1048576).toFixed(1);
  const quotaMB = (quotaBytes / 1048576).toFixed(0);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 text-sm">Storage Utilization</h4>
            <p className="text-xs text-slate-500">{percentage}% of allocated encrypted storage used</p>
          </div>
        </div>
        <span className="text-lg font-bold text-slate-800">{usedMB} MB / {quotaMB} MB</span>
      </div>

      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            percentage > 90 ? 'bg-rose-500' : percentage > 75 ? 'bg-amber-500' : 'bg-indigo-600'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

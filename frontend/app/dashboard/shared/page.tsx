"use client";

import { useEffect, useState } from "react";
import { 
  Inbox, 
  Send, 
  Link as LinkIcon, 
  Loader2, 
  Share2, 
  Trash2, 
  FileText, 
  Clock, 
  Download 
} from "lucide-react";
import {
  getReceivedShares,
  getSentShares,
  getShareLinks,
  revokeShare,
  revokeShareLink,
} from "@/lib/api";

type TabType = "received" | "sent" | "links";

export default function SharedPage() {
  const [tab, setTab] = useState<TabType>("received");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      if (tab === "received") {
        setRows(await getReceivedShares());
      } else if (tab === "sent") {
        setRows(await getSentShares());
      } else {
        setRows(await getShareLinks());
      }
    } catch (e: any) {
      alert(e.message || "Failed to load shares");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tab]);

  const handleRevoke = async (id: number) => {
    if (confirm("Revoke access to this item?")) {
      try {
        if (tab === "sent") {
          await revokeShare(id);
        } else {
          await revokeShareLink(id);
        }
        await load();
      } catch (err: any) {
        alert(err?.message || "Failed to revoke share");
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sharing Center</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage direct user permissions and temporary share links.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-100/80 rounded-xl w-fit border border-slate-200/60">
        <button
          onClick={() => setTab("received")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            tab === "received"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Received</span>
        </button>

        <button
          onClick={() => setTab("sent")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            tab === "sent"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Sent</span>
        </button>

        <button
          onClick={() => setTab("links")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            tab === "links"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          }`}
        >
          <LinkIcon className="w-4 h-4" />
          <span>Share Links</span>
        </button>
      </div>

      {/* Table & Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
          <p className="text-sm font-medium">Loading sharing records...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
          <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl mb-3">
            <Share2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">Nothing here yet</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            {tab === "received"
              ? "Files shared directly with you by other team members will appear here."
              : tab === "sent"
              ? "Direct file shares you've granted to others will be listed here."
              : "Active temporary public links created for your files will show here."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-6 py-3.5">File ID</th>
                  {tab !== "links" && (
                    <th className="px-6 py-3.5">
                      {tab === "sent" ? "Recipient ID" : "Owner ID"}
                    </th>
                  )}
                  <th className="px-6 py-3.5">Permission</th>
                  <th className="px-6 py-3.5">Downloads</th>
                  <th className="px-6 py-3.5">Expires</th>
                  <th className="px-6 py-3.5">Status</th>
                  {tab !== "received" && <th className="px-6 py-3.5 text-right">Action</th>}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const isExpired = r.expires_at && new Date(r.expires_at) < new Date();
                  const isRevoked = r.is_revoked;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <span>File #{r.file_id}</span>
                        </div>
                      </td>

                      {tab !== "links" && (
                        <td className="px-6 py-4 font-medium text-slate-700">
                          User #{tab === "sent" ? r.shared_with_id : r.owner_id}
                        </td>
                      )}

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {r.permission}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Download className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {r.can_download
                              ? `${r.download_count ?? 0}${
                                  r.max_downloads ? ` / ${r.max_downloads}` : ""
                                }`
                              : "Disabled"}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {r.expires_at ? new Date(r.expires_at).toLocaleString() : "Never"}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {isRevoked ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
                            Revoked
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            Expired
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        )}
                      </td>

                      {tab !== "received" && (
                        <td className="px-6 py-4 text-right">
                          {!isRevoked && (
                            <button
                              onClick={() => handleRevoke(r.id)}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-medium text-xs rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Revoke</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Files,
  Folder,
  Share2,
  Settings,
  LayoutDashboard,
  Activity,
  BarChart3,
  ShieldAlert,
  Bell,
  FileBarChart,
  Trash2,
} from "lucide-react";

export const dashboardLinks = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/files",
    label: "My Files",
    icon: Files,
  },
  {
    href: "/dashboard/folders",
    label: "Folders",
    icon: Folder,
  },
  {
    href: "/dashboard/shared",
    label: "Shared",
    icon: Share2,
  },
  { href: "/dashboard/activity", label: "Activity", icon: Activity },
  { href: "/dashboard/monitoring", label: "Monitoring", icon: BarChart3 },
  { href: "/dashboard/security", label: "Security", icon: ShieldAlert },

  { href: "/dashboard/reports", label: "Reports", icon: FileBarChart },
  {
    href: "/dashboard/trash",
    label: "Trash",
    icon: Trash2,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <strong>TrustShare</strong>
      </div>

      <nav>
        {dashboardLinks.map((link) => {
          const Icon = link.icon;

          const active =
            pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                active
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <Icon size={19} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
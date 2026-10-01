import ProtectedRoute from "@/components/ProtectedRoute";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="dashboard-layout">
        <Sidebar />

        <div className="dashboard-main">
          <Navbar />

          <main className="dashboard-content">
            {children}
          </main>

        </div>
      </div>
    </ProtectedRoute>
  );
}
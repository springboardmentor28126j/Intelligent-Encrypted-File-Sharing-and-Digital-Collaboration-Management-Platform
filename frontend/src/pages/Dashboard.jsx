import React from 'react';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../services/authService';

function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b px-8 py-4 flex justify-between items-center shadow-sm">
        <h1 className="text-xl font-bold text-gray-800">TrustShare Dashboard</h1>
        <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded">
          Logout
        </button>
      </nav>
      <div className="flex-1 flex items-center justify-center">
        <div className="border-2 border-dashed border-gray-300 p-12 rounded-lg text-center">
          <p className="text-gray-500 font-medium text-lg">Dashboard Abhi Khali Hai (Milestone 1 File Upload Flow Next...)</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
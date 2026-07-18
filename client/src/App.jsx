import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import DashboardLayout from './components/Layout/DashboardLayout';
import Login from './pages/Login';
import Attendance from './pages/Attendance';
import LeaveManagement from './pages/LeaveManagement';
import ExpenseManagement from './pages/ExpenseManagement';
import Dashboard from './pages/Dashboard';
import Signup from './pages/Signup';
import AdminPanel from './pages/AdminPanel';
const Profile = () => <div className="page-container"><h2>Profile</h2></div>;

// Route Guard Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.some(role => hasRole(role))) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
            {/* Public landing: login at root */}
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected app routes mounted under /app */}
            <Route path="/app/*" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="leaves" element={<LeaveManagement />} />
              <Route path="expenses" element={<ExpenseManagement />} />
              <Route path="profile" element={<Profile />} />

              <Route path="admin" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <AdminPanel />
                </ProtectedRoute>
              } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

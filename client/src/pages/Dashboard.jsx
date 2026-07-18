import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import { 
  Users, Calendar, Clock, Receipt, IndianRupee,
  TrendingUp, Activity, CheckCircle2, AlertCircle, Layers, Filter
} from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
  const { user, hasRole } = useAuth();
  const [stats, setStats] = useState(null);
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRoles();
    fetchDashboardData();
  }, [selectedRole]);

  const fetchRoles = async () => {
    try {
      if (hasRole('admin')) {
        const res = await api.get('/admin/roles');
        setRoles(res.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching roles', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      if (hasRole('admin')) {
        const url = selectedRole ? `/admin/dashboard?role=${selectedRole}` : '/admin/dashboard';
        const res = await api.get(url);
        setStats(res.data.data);
      } else {
        // Employee dashboard specific data
        const [attendanceRes, leaveRes] = await Promise.all([
          api.get('/attendance/today'),
          api.get('/leaves/balance')
        ]);
        setStats({
          todayAttendance: attendanceRes.data.data,
          leaveBalances: leaveRes.data.data
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <div className="page-container"><span className="spinner"></span></div>;

  const isAdmin = hasRole('admin');

  return (
    <div className="page-container">
      <div className="dashboard-header mb-4">
        <h2>Welcome back, {user?.first_name}! 👋</h2>
        <p className="text-secondary">Here's what's happening today.</p>
      </div>

      {isAdmin && stats && (
        <div className="admin-dashboard">
         

          <div className="stat-grid mb-4">
            <div className="stat-card glass-panel">
              <div className="stat-icon-wrapper primary">
                <Users size={24} />
              </div>
              <div className="stat-info">
                <h3>Total Employees</h3>
                <p className="stat-value">{stats.totalEmployees || 0}</p>
              </div>
            </div>
            
            <div className="stat-card glass-panel">
              <div className="stat-icon-wrapper success">
                <CheckCircle2 size={24} />
              </div>
              <div className="stat-info">
                <h3>Attendance Today</h3>
                <p className="stat-value">{stats.todayAttendance || 0}</p>
              </div>
            </div>

            <div className="stat-card glass-panel">
              <div className="stat-icon-wrapper warning">
                <Calendar size={24} />
              </div>
              <div className="stat-info">
                <h3>Pending Leaves</h3>
                <p className="stat-value">{stats.pendingLeaves || 0}</p>
              </div>
            </div>

            <div className="stat-card glass-panel">
              <div className="stat-icon-wrapper danger">
                <IndianRupee size={24} />
              </div>
              <div className="stat-info">
                <h3>Pending Expenses</h3>
                <p className="stat-value">₹{stats.pendingExpensesAmount || 0}</p>
              </div>
            </div>
          </div>

          <div className="dashboard-row">
            <div className="dashboard-card glass-panel flex-2">
              <div className="card-header">
                <h3><Activity size={20} /> Attendance Records</h3>
              </div>
              <div className="card-body">
                {stats.attendanceRecords?.length ? stats.attendanceRecords.map((entry) => (
                  <div key={entry.id} className="overview-item">
                    <div>
                      <strong>{entry.user_name}</strong>
                      <p className="text-muted">{new Date(entry.date).toLocaleDateString()}</p>
                    </div>
                    <div className="badge-pill bg-tertiary">
                      {entry.check_in_time ? `In: ${new Date(entry.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No check-in'}
                      {entry.check_out_time ? ` • Out: ${new Date(entry.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </div>
                  </div>
                )) : <p className="text-muted">No attendance records available.</p>}
              </div>
            </div>
            
            <div className="dashboard-card glass-panel flex-1 department-card">
              <div className="card-header">
                <h3><Layers size={20} /> Department Attendance</h3>
              </div>
              <div className="card-body department-breakdown">
                {stats.departmentStats?.length ? stats.departmentStats.map((dept) => {
                  const percentage = dept.employee_count > 0
                    ? Math.round((dept.present_today / dept.employee_count) * 100)
                    : 0;
                  return (
                    <div key={dept.name} className="dept-item">
                      <div className="dept-info">
                        <strong>{dept.name}</strong>
                        <span>{dept.present_today}/{dept.employee_count} present</span>
                      </div>
                      <div className="dept-progress">
                        <div className="dept-progress-fill" style={{ width: `${percentage}%` }} />
                      </div>
                      <span className="dept-percent">{percentage}%</span>
                    </div>
                  );
                }) : (
                  <p className="text-muted">No department attendance data available.</p>
                )}
              </div>
            </div>

            <div className="dashboard-card glass-panel flex-1">
              <div className="card-header">
                <h3><TrendingUp size={20} /> Latest Approvals</h3>
              </div>
              <div className="card-body">
                {stats.pendingLeaveRequests?.length || stats.pendingExpenseRequests?.length ? (
                  <>
                    {stats.pendingLeaveRequests?.slice(0, 4).map((req) => (
                      <div key={`leave-${req.id}`} className="overview-item">
                        <span>{req.user_name}: {req.leave_type_name}</span>
                        <span className="badge-pill bg-tertiary">{req.status}</span>
                      </div>
                    ))}
                    {stats.pendingExpenseRequests?.slice(0, 4).map((req) => (
                      <div key={`expense-${req.id}`} className="overview-item">
                        <span>{req.user_name}: {req.title}</span>
                        <span className="badge-pill bg-tertiary">₹{req.amount}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="empty-state sm">
                    <p>No pending approvals at the moment.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!isAdmin && stats && (
        <div className="employee-dashboard">
          <div className="dashboard-row mb-4">
            <div className="dashboard-card glass-panel flex-1">
              <div className="card-header">
                <h3><Clock size={20} /> Today's Attendance</h3>
              </div>
              <div className="card-body text-center py-4">
                {stats.todayAttendance ? (
                  <>
                    <div className={`status-orb ${stats.todayAttendance.status}`}></div>
                    <h4 className="mt-3 capitalize">{stats.todayAttendance.status.replace('_', ' ')}</h4>
                    <p className="text-muted mt-2">
                      Check-in: {new Date(stats.todayAttendance.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="status-orb missing"></div>
                    <h4 className="mt-3">Not Checked In</h4>
                    <p className="text-muted mt-2">Please check in to mark your attendance.</p>
                  </>
                )}
              </div>
            </div>

            <div className="dashboard-card glass-panel flex-2">
              <div className="card-header">
                <h3><Calendar size={20} /> Leave Balance</h3>
              </div>
              <div className="card-body">
                {stats.leaveBalances?.length > 0 ? (
                  <div className="mini-balances">
                    {stats.leaveBalances.slice(0, 3).map(bal => (
                      <div key={bal.id} className="mini-balance-item">
                        <div className="mb-header">
                          <span>{bal.leave_type_name}</span>
                          <strong>{bal.remaining_days}/{bal.total_days}</strong>
                        </div>
                        <div className="progress-bar sm">
                          <div className="progress-fill" style={{ width: `${(bal.used_days / bal.total_days) * 100}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted">No leave balances available.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

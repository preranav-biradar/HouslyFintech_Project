import React, { useEffect, useState } from "react";
import api from "../api/axios";
import {
  Users,
  Calendar,
  Receipt,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import "./AdminPanel.css";

const formatTime = (value) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const AdminPanel = () => {
  const [stats, setStats] = useState(null);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [rejectedLeaves, setRejectedLeaves] = useState([]);
  const [pendingExpenses, setPendingExpenses] = useState([]);
  const [approvedExpenses, setApprovedExpenses] = useState([]);
  const [rejectedExpenses, setRejectedExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [
        dashboardRes,
        leaveRes,
        leaveApprovedRes,
        leaveRejectedRes,
        expenseRes,
        expenseApprovedRes,
        expenseRejectedRes,
      ] = await Promise.all([
        api.get("/admin/dashboard"),
        api.get("/leaves/pending"),
        api.get("/leaves/approved"),
        api.get("/leaves/rejected"),
        api.get("/expenses/pending"),
        api.get("/expenses/approved"),
        api.get("/expenses/rejected"),
      ]);
      const dashboardData = dashboardRes.data.data || {};
      setStats(dashboardData);
      setPendingLeaves(leaveRes.data.data);
      setApprovedLeaves(leaveApprovedRes.data.data);
      setRejectedLeaves(leaveRejectedRes.data.data);
      setPendingExpenses(expenseRes.data.data);
      setApprovedExpenses(expenseApprovedRes.data.data);
      setRejectedExpenses(expenseRejectedRes.data.data);
    } catch (error) {
      console.error("Error loading admin data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleApproveLeave = async (id) => {
    try {
      await api.put(`/leaves/${id}/approve`);
      await loadAdminData();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to approve leave request");
    }
  };

  const handleRejectLeave = async (id) => {
    const reason = window.prompt("Enter rejection reason for leave:");
    if (reason !== null) {
      try {
        await api.put(`/leaves/${id}/reject`, { rejection_reason: reason });
        await loadAdminData();
      } catch (error) {
        alert(
          error.response?.data?.message || "Failed to reject leave request",
        );
      }
    }
  };

  const handleApproveExpense = async (id) => {
    try {
      await api.put(`/expenses/${id}/approve`);
      await loadAdminData();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to approve expense claim");
    }
  };

  const handleRejectExpense = async (id) => {
    const reason = window.prompt("Enter rejection reason for expense:");
    if (reason !== null) {
      try {
        await api.put(`/expenses/${id}/reject`, { rejection_reason: reason });
        await loadAdminData();
      } catch (error) {
        alert(
          error.response?.data?.message || "Failed to reject expense claim",
        );
      }
    }
  };

  if (isLoading)
    return (
      <div className="page-container">
        <span className="spinner"></span>
      </div>
    );

  return (
    <div className="admin-panel-container">
      <header className="admin-hero glass-panel">
       <div>
  <p className="eyebrow">Hously Finntech Realty • Employee Management System</p>

  <h1>One Platform to Manage Your Entire Workforce</h1>

  <p className="hero-copy">
    Welcome to Hously EMS, a modern workforce management platform designed to
    simplify daily operations. From GPS-based attendance and selfie
    verification to leave approvals, expense claims, employee records,
    notifications, and role-based access, everything is managed securely from
    one intuitive dashboard, enabling organizations to improve efficiency,
    accountability, and employee experience.
  </p>
</div>
        <div className="hero-metrics">
          <div className="metric-card accent">
            <p>Total Employees</p>
            <strong>{stats?.totalEmployees ?? 0}</strong>
          </div>
          <div className="metric-card success">
            <p>Today's Attendance</p>
            <strong>{stats?.todayAttendance ?? 0}</strong>
          </div>
          <div className="metric-card warning">
            <p>Pending Leaves</p>
            <strong>{stats?.pendingLeaves ?? 0}</strong>
          </div>
          <div className="metric-card danger">
            <p>Pending Expenses</p>
            <strong>{stats?.pendingExpensesCount ?? 0}</strong>
          </div>
        </div>
      </header>

      <div className="data-panel glass-panel">
        <div className="data-panel-header">
          <h3>
            <Clock size={20} /> Today's Attendance Records
          </h3>
          <span className="pill">Latest two days</span>
        </div>
        <div className="record-list">
          {stats?.attendanceRecords?.length ? (
            stats.attendanceRecords.map((record) => (
              <div key={record.id} className="record-card">
                <div>
                  <strong>{record.user_name}</strong>
                  <p className="subtext">
                    {new Date(record.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="status-group">
                  <span className="status-chip">
                    {record.status?.replace("_", " ") || "Unknown"}
                  </span>
                  <span>
                    {record.check_in_time
                      ? `In ${formatTime(record.check_in_time)}`
                      : "No check-in"}
                  </span>
                  <span>
                    {record.check_out_time
                      ? `Out ${formatTime(record.check_out_time)}`
                      : ""}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted">
              No attendance records found for today or yesterday.
            </p>
          )}
        </div>
      </div>

      <div className="action-grids">
        <div className="data-panel glass-panel">
          <div className="data-panel-header">
            <h3>
              <Calendar size={20} /> Pending Leave Requests
            </h3>
            <span className="pill">Needs decision</span>
          </div>
          <div className="record-list">
            {pendingLeaves.length ? (
              pendingLeaves.map((item) => (
                <div key={item.id} className="record-card with-actions">
                  <div>
                    <strong>{item.user_name}</strong>
                    <p className="subtext">
                      {item.leave_type_name} •{" "}
                      {new Date(item.start_date).toLocaleDateString()} -{" "}
                      {new Date(item.end_date).toLocaleDateString()}
                    </p>
                    <p className="subtext">
                      {item.reason || "No description provided"}
                    </p>
                  </div>
                  <div className="action-buttons">
                    <button
                      className="btn-success sm"
                      onClick={() => handleApproveLeave(item.id)}
                    >
                      Approve
                    </button>
                    <button
                      className="btn-danger sm"
                      onClick={() => handleRejectLeave(item.id)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted">No pending leave requests.</p>
            )}
          </div>
        </div>

        <div className="data-panel glass-panel">
          <div className="data-panel-header">
            <h3>
              <Receipt size={20} /> Pending Expense Claims
            </h3>
            <span className="pill">Review now</span>
          </div>
          <div className="record-list">
            {pendingExpenses.length ? (
              pendingExpenses.map((item) => (
                <div key={item.id} className="record-card with-actions">
                  <div>
                    <strong>{item.user_name}</strong>
                    <p className="subtext">
                      {item.title} •{" "}
                      {new Date(item.expense_date).toLocaleDateString()}
                    </p>
                    <p className="subtext">
                      {item.description || "No description provided"}
                    </p>
                  </div>
                  <div className="action-buttons">
                    <button
                      className="btn-success sm"
                      onClick={() => handleApproveExpense(item.id)}
                    >
                      Approve
                    </button>
                    <button
                      className="btn-danger sm"
                      onClick={() => handleRejectExpense(item.id)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted">No pending expense claims.</p>
            )}
          </div>
        </div>
      </div>

      <div className="historic-grids mt-4">
        <div className="dashboard-card glass-panel flex-1">
          <div className="card-header">
            <h3>
              <Receipt size={20} /> Pending Expense Claims
            </h3>
          </div>
          <div className="card-body">
            {pendingExpenses.length ? (
              pendingExpenses.map((item) => (
                <div key={item.id} className="overview-item with-actions">
                  <div>
                    <strong>{item.user_name}</strong>
                    <p className="text-muted">
                      {item.title} •{" "}
                      {new Date(item.expense_date).toLocaleDateString()}
                    </p>
                    <p className="text-muted">
                      {item.description || "No description provided"}
                    </p>
                  </div>
                  <div className="action-buttons">
                    <button
                      className="btn-success sm"
                      onClick={() => handleApproveExpense(item.id)}
                    >
                      Approve
                    </button>
                    <button
                      className="btn-danger sm"
                      onClick={() => handleRejectExpense(item.id)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted">No pending expense claims.</p>
            )}
          </div>
        </div>
      </div>

      <div className="historic-grids mt-4">
        <div className="historic-card glass-panel">
          <div className="historic-header">
            <h3>
              <CheckCircle2 size={20} /> Approved Leave Requests
            </h3>
            <span className="pill">Recent</span>
          </div>
          <div className="historic-list">
            {approvedLeaves.length ? (
              approvedLeaves.map((item) => (
                <div key={item.id} className="historic-item">
                  <div>
                    <strong>{item.user_name}</strong>
                    <p className="subtext">
                      {item.leave_type_name} •{" "}
                      {new Date(item.start_date).toLocaleDateString()} -{" "}
                      {new Date(item.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="badge-pill bg-success">Approved</span>
                </div>
              ))
            ) : (
              <p className="text-muted">No approved leave requests yet.</p>
            )}
          </div>
        </div>

        <div className="historic-card glass-panel">
          <div className="historic-header">
            <h3>
              <XCircle size={20} /> Rejected Leave Requests
            </h3>
            <span className="pill">Recent</span>
          </div>
          <div className="historic-list">
            {rejectedLeaves.length ? (
              rejectedLeaves.map((item) => (
                <div key={item.id} className="historic-item">
                  <div>
                    <strong>{item.user_name}</strong>
                    <p className="subtext">
                      {item.leave_type_name} •{" "}
                      {new Date(item.start_date).toLocaleDateString()} -{" "}
                      {new Date(item.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="badge-pill bg-danger">Rejected</span>
                </div>
              ))
            ) : (
              <p className="text-muted">No rejected leave requests yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="historic-grids mt-4">
        <div className="historic-card glass-panel">
          <div className="historic-header">
            <h3>
              <CheckCircle2 size={20} /> Approved Expense Claims
            </h3>
            <span className="pill">Recent</span>
          </div>
          <div className="historic-list">
            {approvedExpenses.length ? (
              approvedExpenses.map((item) => (
                <div key={item.id} className="historic-item">
                  <div>
                    <strong>{item.user_name}</strong>
                    <p className="subtext">
                      {item.title} •{" "}
                      {new Date(item.expense_date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="badge-pill bg-success">₹{item.amount}</span>
                </div>
              ))
            ) : (
              <p className="text-muted">No approved expense claims yet.</p>
            )}
          </div>
        </div>

        <div className="historic-card glass-panel">
          <div className="historic-header">
            <h3>
              <XCircle size={20} /> Rejected Expense Claims
            </h3>
            <span className="pill">Recent</span>
          </div>
          <div className="historic-list">
            {rejectedExpenses.length ? (
              rejectedExpenses.map((item) => (
                <div key={item.id} className="historic-item">
                  <div>
                    <strong>{item.user_name}</strong>
                    <p className="subtext">
                      {item.title} •{" "}
                      {new Date(item.expense_date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="badge-pill bg-danger">₹{item.amount}</span>
                </div>
              ))
            ) : (
              <p className="text-muted">No rejected expense claims yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;

import React, { useEffect, useState } from "react";
import api from "../api/axios";
import {
  Users, Calendar, Receipt, Clock, CheckCircle2, XCircle,
  ShieldCheck, Layers, TrendingUp, AlertTriangle, IndianRupee,
  Activity, RefreshCw, ChevronRight, UserCheck
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid, PieChart, Pie, Legend, LineChart, Line,
  AreaChart, Area
} from 'recharts';
import "./AdminPanel.css";

const formatTime = (value) =>
  value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "–";

const DEPT_COLORS = ['#60a5fa', '#34d399', '#a78bfa', '#fbbf24', '#f472b6'];

const AdminPanel = () => {
  const [stats, setStats] = useState(null);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [rejectedLeaves, setRejectedLeaves] = useState([]);
  const [pendingExpenses, setPendingExpenses] = useState([]);
  const [approvedExpenses, setApprovedExpenses] = useState([]);
  const [rejectedExpenses, setRejectedExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('leaves');

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [dashboardRes, leaveRes, leaveApprovedRes, leaveRejectedRes, expenseRes, expenseApprovedRes, expenseRejectedRes] = await Promise.all([
        api.get("/admin/dashboard"),
        api.get("/leaves/pending"),
        api.get("/leaves/approved"),
        api.get("/leaves/rejected"),
        api.get("/expenses/pending"),
        api.get("/expenses/approved"),
        api.get("/expenses/rejected"),
      ]);
      setStats(dashboardRes.data.data || {});
      setPendingLeaves(leaveRes.data.data || []);
      setApprovedLeaves(leaveApprovedRes.data.data || []);
      setRejectedLeaves(leaveRejectedRes.data.data || []);
      setPendingExpenses(expenseRes.data.data || []);
      setApprovedExpenses(expenseApprovedRes.data.data || []);
      setRejectedExpenses(expenseRejectedRes.data.data || []);
    } catch (error) {
      console.error("Error loading admin data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadAdminData(); }, []);

  const handleApproveLeave = async (id) => {
    try { await api.put(`/leaves/${id}/approve`); await loadAdminData(); }
    catch (error) { alert(error.response?.data?.message || "Failed to approve leave"); }
  };

  const handleRejectLeave = async (id) => {
    const reason = window.prompt("Enter rejection reason for leave:");
    if (reason !== null) {
      try { await api.put(`/leaves/${id}/reject`, { rejection_reason: reason }); await loadAdminData(); }
      catch (error) { alert(error.response?.data?.message || "Failed to reject leave"); }
    }
  };

  const handleApproveExpense = async (id) => {
    try { await api.put(`/expenses/${id}/approve`); await loadAdminData(); }
    catch (error) { alert(error.response?.data?.message || "Failed to approve expense"); }
  };

  const handleRejectExpense = async (id) => {
    const reason = window.prompt("Enter rejection reason for expense:");
    if (reason !== null) {
      try { await api.put(`/expenses/${id}/reject`, { rejection_reason: reason }); await loadAdminData(); }
      catch (error) { alert(error.response?.data?.message || "Failed to reject expense"); }
    }
  };

  if (isLoading) return (
    <div className="ap-loading">
      <div className="ap-spinner"></div>
      <p>Loading Admin Panel…</p>
    </div>
  );

  const deptPieData = (stats?.departmentStats || stats?.department_stats || []).filter(d => d.employee_count > 0 && d.name !== 'Human Resources');
  const attendanceRate = stats?.totalEmployees > 0
    ? Math.round(((stats?.todayAttendance || 0) / stats.totalEmployees) * 100)
    : 0;

  return (
    <div className="ap-container">

      {/* ─── KPI Strip ─── */}
      <div className="ap-kpi-strip">
        <div className="ap-kpi ap-kpi--blue">
          <div className="ap-kpi-icon"><Users size={22} /></div>
          <div className="ap-kpi-body">
            <span className="ap-kpi-label">Total Employees</span>
            <span className="ap-kpi-value">{stats?.totalEmployees ?? 0}</span>
          </div>
        </div>
        <div className="ap-kpi ap-kpi--green">
          <div className="ap-kpi-icon"><UserCheck size={22} /></div>
          <div className="ap-kpi-body">
            <span className="ap-kpi-label">Present Today</span>
            <span className="ap-kpi-value">{stats?.todayAttendance ?? 0}</span>
          </div>
          <div className="ap-kpi-rate">{attendanceRate}%</div>
        </div>
        <div className="ap-kpi ap-kpi--amber">
          <div className="ap-kpi-icon"><Calendar size={22} /></div>
          <div className="ap-kpi-body">
            <span className="ap-kpi-label">Pending Leaves</span>
            <span className="ap-kpi-value">{stats?.pendingLeaves ?? pendingLeaves.length}</span>
          </div>
        </div>
        <div className="ap-kpi ap-kpi--rose">
          <div className="ap-kpi-icon"><IndianRupee size={22} /></div>
          <div className="ap-kpi-body">
            <span className="ap-kpi-label">Pending Expenses</span>
            <span className="ap-kpi-value">₹{stats?.pendingExpensesAmount ?? 0}</span>
          </div>
        </div>
      </div>

      {/* ─── Charts Row ─── */}
      <div className="ap-charts-row">

        {/* Department Attendance Bar Chart */}
        <div className="ap-card ap-card--wide">
          <div className="ap-card-head">
            <span className="ap-card-icon"><Activity size={18} /></span>
            <h3>Department Attendance</h3>
          </div>
          <div className="ap-chart-area">
            {deptPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={deptPieData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(12px)' }}
                    labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                    itemStyle={{ color: '#94a3b8' }}
                  />
                  <Bar dataKey="present_today" name="Present" radius={[6, 6, 0, 0]}>
                    {deptPieData.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
                  </Bar>
                  <Bar dataKey="employee_count" name="Total" radius={[6, 6, 0, 0]} fill="rgba(255,255,255,0.08)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="ap-empty"><Layers size={40} /><p>No department data yet</p></div>
            )}
          </div>
        </div>

        {/* Workforce Distribution Pie */}
        <div className="ap-card">
          <div className="ap-card-head">
            <span className="ap-card-icon"><Layers size={18} /></span>
            <h3>Workforce Distribution</h3>
          </div>
          <div className="ap-chart-area">
            {deptPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={deptPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={4} dataKey="employee_count" nameKey="name" stroke="none">
                    {deptPieData.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    itemStyle={{ color: '#f1f5f9' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="ap-empty"><Layers size={40} /><p>No distribution data</p></div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Attendance Feed ─── */}
      <div className="ap-card">
        <div className="ap-card-head">
          <span className="ap-card-icon"><Clock size={18} /></span>
          <h3>Today's Attendance Feed</h3>
          <span className="ap-pill">Live</span>
        </div>
        <div className="ap-feed">
          {stats?.attendanceRecords?.length ? stats.attendanceRecords.map((r, i) => (
            <div key={r.id} className="ap-feed-item" style={{ animationDelay: `${i * 0.04}s` }}>
              <div className="ap-feed-avatar">{r.user_name?.charAt(0) || 'U'}</div>
              <div className="ap-feed-info">
                <strong>{r.user_name}</strong>
                <span>{new Date(r.date).toLocaleDateString()}</span>
              </div>
              <div className="ap-feed-times">
                {r.check_in_time && <span className="ap-time-badge ap-time-badge--in">In {formatTime(r.check_in_time)}</span>}
                {r.check_out_time && <span className="ap-time-badge ap-time-badge--out">Out {formatTime(r.check_out_time)}</span>}
                {!r.check_in_time && <span className="ap-time-badge ap-time-badge--absent">Absent</span>}
              </div>
              <span className={`ap-status-dot ap-status-dot--${r.status === 'present' ? 'green' : r.status === 'absent' ? 'red' : 'amber'}`}></span>
            </div>
          )) : (
            <div className="ap-empty"><Activity size={40} /><p>No attendance records found</p></div>
          )}
        </div>
      </div>

      {/* ─── Approval Tabs ─── */}
      <div className="ap-card">
        <div className="ap-card-head">
          <span className="ap-card-icon"><AlertTriangle size={18} /></span>
          <h3>Pending Approvals</h3>
          <div className="ap-tabs">
            <button className={`ap-tab ${activeTab === 'leaves' ? 'active' : ''}`} onClick={() => setActiveTab('leaves')}>
              <Calendar size={14} /> Leaves <span className="ap-tab-badge">{pendingLeaves.length}</span>
            </button>
            <button className={`ap-tab ${activeTab === 'expenses' ? 'active' : ''}`} onClick={() => setActiveTab('expenses')}>
              <Receipt size={14} /> Expenses <span className="ap-tab-badge">{pendingExpenses.length}</span>
            </button>
          </div>
        </div>

        <div className="ap-approval-list">
          {activeTab === 'leaves' && (
            pendingLeaves.length ? pendingLeaves.map((item, i) => (
              <div key={item.id} className="ap-approval-item" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="ap-approval-avatar">{item.user_name?.charAt(0)}</div>
                <div className="ap-approval-info">
                  <strong>{item.user_name}</strong>
                  <span className="ap-approval-meta">{item.leave_type_name} • {new Date(item.start_date).toLocaleDateString()} – {new Date(item.end_date).toLocaleDateString()}</span>
                  {item.reason && <span className="ap-approval-reason">"{item.reason}"</span>}
                </div>
                <div className="ap-approval-actions">
                  <button className="ap-btn-approve" onClick={() => handleApproveLeave(item.id)}><CheckCircle2 size={14} /> Approve</button>
                  <button className="ap-btn-reject" onClick={() => handleRejectLeave(item.id)}><XCircle size={14} /> Reject</button>
                </div>
              </div>
            )) : <div className="ap-empty"><CheckCircle2 size={36} /><p>All leave requests resolved</p></div>
          )}
          {activeTab === 'expenses' && (
            pendingExpenses.length ? pendingExpenses.map((item, i) => (
              <div key={item.id} className="ap-approval-item" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="ap-approval-avatar" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>₹</div>
                <div className="ap-approval-info">
                  <strong>{item.user_name}</strong>
                  <span className="ap-approval-meta">{item.title} • {new Date(item.expense_date).toLocaleDateString()}</span>
                  <span className="ap-approval-amount">₹{item.amount}</span>
                  {item.description && <span className="ap-approval-reason">"{item.description}"</span>}
                </div>
                <div className="ap-approval-actions">
                  <button className="ap-btn-approve" onClick={() => handleApproveExpense(item.id)}><CheckCircle2 size={14} /> Approve</button>
                  <button className="ap-btn-reject" onClick={() => handleRejectExpense(item.id)}><XCircle size={14} /> Reject</button>
                </div>
              </div>
            )) : <div className="ap-empty"><CheckCircle2 size={36} /><p>All expense claims resolved</p></div>
          )}
        </div>
      </div>

      {/* ─── History Grid ─── */}
      <div className="ap-history-grid">
        {/* Approved Leaves */}
        <div className="ap-card">
          <div className="ap-card-head">
            <span className="ap-card-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399' }}><CheckCircle2 size={16} /></span>
            <h3>Approved Leaves</h3>
            <span className="ap-pill ap-pill--green">{approvedLeaves.length} total</span>
          </div>
          <div className="ap-history-list">
            {approvedLeaves.length ? approvedLeaves.slice(0, 6).map(item => (
              <div key={item.id} className="ap-history-item">
                <div className="ap-history-info">
                  <strong>{item.user_name}</strong>
                  <span>{item.leave_type_name} • {new Date(item.start_date).toLocaleDateString()}</span>
                </div>
                <span className="ap-badge ap-badge--green">Approved</span>
              </div>
            )) : <p className="ap-muted">No approved leaves yet</p>}
          </div>
        </div>

        {/* Rejected Leaves */}
        <div className="ap-card">
          <div className="ap-card-head">
            <span className="ap-card-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}><XCircle size={16} /></span>
            <h3>Rejected Leaves</h3>
            <span className="ap-pill ap-pill--red">{rejectedLeaves.length} total</span>
          </div>
          <div className="ap-history-list">
            {rejectedLeaves.length ? rejectedLeaves.slice(0, 6).map(item => (
              <div key={item.id} className="ap-history-item">
                <div className="ap-history-info">
                  <strong>{item.user_name}</strong>
                  <span>{item.leave_type_name} • {new Date(item.start_date).toLocaleDateString()}</span>
                </div>
                <span className="ap-badge ap-badge--red">Rejected</span>
              </div>
            )) : <p className="ap-muted">No rejected leaves yet</p>}
          </div>
        </div>

        {/* Approved Expenses */}
        <div className="ap-card">
          <div className="ap-card-head">
            <span className="ap-card-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399' }}><IndianRupee size={16} /></span>
            <h3>Approved Expenses</h3>
            <span className="ap-pill ap-pill--green">{approvedExpenses.length} total</span>
          </div>
          <div className="ap-history-list">
            {approvedExpenses.length ? approvedExpenses.slice(0, 6).map(item => (
              <div key={item.id} className="ap-history-item">
                <div className="ap-history-info">
                  <strong>{item.user_name}</strong>
                  <span>{item.title} • {new Date(item.expense_date).toLocaleDateString()}</span>
                </div>
                <span className="ap-badge ap-badge--green">₹{item.amount}</span>
              </div>
            )) : <p className="ap-muted">No approved expenses yet</p>}
          </div>
        </div>

        {/* Rejected Expenses */}
        <div className="ap-card">
          <div className="ap-card-head">
            <span className="ap-card-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}><XCircle size={16} /></span>
            <h3>Rejected Expenses</h3>
            <span className="ap-pill ap-pill--red">{rejectedExpenses.length} total</span>
          </div>
          <div className="ap-history-list">
            {rejectedExpenses.length ? rejectedExpenses.slice(0, 6).map(item => (
              <div key={item.id} className="ap-history-item">
                <div className="ap-history-info">
                  <strong>{item.user_name}</strong>
                  <span>{item.title} • {new Date(item.expense_date).toLocaleDateString()}</span>
                </div>
                <span className="ap-badge ap-badge--red">₹{item.amount}</span>
              </div>
            )) : <p className="ap-muted">No rejected expenses yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;

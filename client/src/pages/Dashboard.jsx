import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import {
  Users, Calendar, Clock, Receipt, IndianRupee, TrendingUp,
  Activity, CheckCircle2, Layers, Briefcase, ShieldCheck, Award,
  Sun, Moon, Zap, AlertCircle, XCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, AreaChart, Area, CartesianGrid, Legend
} from 'recharts';
import './Dashboard.css';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const Dashboard = () => {
  const { user, hasRole } = useAuth();
  const [stats, setStats] = useState(null);
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening');
  }, []);

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
    } catch (error) { console.error('Error fetching roles', error); }
  };

  const fetchDashboardData = async () => {
    try {
      if (hasRole('admin')) {
        const url = selectedRole ? `/admin/dashboard?role=${selectedRole}` : '/admin/dashboard';
        const res = await api.get(url);
        setStats(res.data.data);
      } else {
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

  if (isLoading) return (
    <div className="db-loading">
      <div className="db-spinner"></div>
    </div>
  );

  const isAdmin = hasRole('admin');

  return (
    <div className="db-page">

      {/* ─── Greeting Header ─── */}
      <div className="db-greeting">
        <div>
          <p className="db-greeting-sub">{greeting},</p>
          <h1 className="db-greeting-name">{user?.first_name} {user?.last_name} <span className="db-wave">👋</span></h1>
          <p className="db-greeting-dept">
            {isAdmin ? '🛡️ Administrator' : user?.department_name ? `📂 ${user.department_name}` : ''}
          </p>
        </div>
        <div className="db-greeting-date">
          <span className="db-date-big">{new Date().toLocaleDateString('en-IN', { weekday: 'long' })}</span>
          <span className="db-date-small">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* ════════════════════════════════
          ADMIN VIEW
      ════════════════════════════════ */}
      {isAdmin && stats && (
        <div className="db-admin">

          {/* Hero Banner */}
          <div className="db-hero-banner glass-panel">
            <div className="db-hero-text">
              <h2 className="text-gradient">Command Center</h2>
              <p>Oversee your entire organization — attendance, leaves, expenses — from one unified panel.</p>
            </div>
            <div className="db-hero-metrics">
              <div className="db-hero-metric">
                <span className="db-hero-metric-label">Active Workforce</span>
                <span className="db-hero-metric-value">{stats.totalEmployees || 0}</span>
              </div>
              <div className="db-hero-metric db-hero-metric--green">
                <span className="db-hero-metric-label">Present Today</span>
                <span className="db-hero-metric-value" style={{ color: '#34d399' }}>{stats.todayAttendance || 0}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="db-section-title"><Zap size={20} /> Quick Actions</div>
          <div className="db-quick-actions">
            <div className="db-action-card" onClick={() => window.location.href = '/app/admin'} style={{ '--accent': '#60a5fa' }}>
              <div className="db-action-icon" style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}><Users size={28} /></div>
              <h4>Manage Employees</h4>
              <p>View and manage workforce</p>
            </div>
            <div className="db-action-card" onClick={() => window.location.href = '/app/leaves'} style={{ '--accent': '#fbbf24' }}>
              <div className="db-action-icon" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}><Calendar size={28} /></div>
              <h4>Review Leaves</h4>
              <p>{stats.pendingLeaves || 0} pending requests</p>
            </div>
            <div className="db-action-card" onClick={() => window.location.href = '/app/expenses'} style={{ '--accent': '#34d399' }}>
              <div className="db-action-icon" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}><Receipt size={28} /></div>
              <h4>Expense Claims</h4>
              <p>{stats.pendingExpensesAmount ? `₹${stats.pendingExpensesAmount} pending` : 'All resolved'}</p>
            </div>
            <div className="db-action-card" onClick={() => window.location.href = '/app/attendance'} style={{ '--accent': '#a78bfa' }}>
              <div className="db-action-icon" style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}><Clock size={28} /></div>
              <h4>Attendance</h4>
              <p>View today's logs</p>
            </div>
          </div>

          {/* Charts */}
          <div className="db-chart-row">
            <div className="db-chart-card glass-panel">
              <div className="db-chart-head"><Layers size={18} /> Workforce Distribution</div>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={(stats.departmentStats || []).filter(d => d.employee_count > 0 && d.name !== 'Human Resources')}
                    cx="50%" cy="50%"
                    innerRadius={65} outerRadius={100}
                    paddingAngle={4}
                    dataKey="employee_count" nameKey="name"
                    stroke="none"
                  >
                    {(stats.departmentStats || []).filter(d => d.employee_count > 0 && d.name !== 'Human Resources').map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} itemStyle={{ color: '#f1f5f9' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="db-chart-card glass-panel">
              <div className="db-chart-head"><Activity size={18} /> Today's Attendance by Dept</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={(stats.departmentStats || []).filter(d => d.name !== 'Human Resources')} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} itemStyle={{ color: '#f1f5f9' }} />
                  <Bar dataKey="present_today" name="Present" radius={[6, 6, 0, 0]}>
                    {(stats.departmentStats || []).filter(d => d.name !== 'Human Resources').map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                  <Bar dataKey="employee_count" name="Total" radius={[6, 6, 0, 0]} fill="rgba(255,255,255,0.06)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          EMPLOYEE VIEW
      ════════════════════════════════ */}
      {!isAdmin && stats && (
        <div className="db-employee">

          {/* Attendance Status Card */}
          <div className="db-att-row">
            <div className="db-att-status glass-panel">
              <div className="db-att-head"><Clock size={20} /> Today's Status</div>
              <div className="db-att-body">
                {stats.todayAttendance ? (
                  <>
                    <div className={`db-orb db-orb--${stats.todayAttendance.status}`}>
                      {stats.todayAttendance.status === 'present' && <CheckCircle2 size={40} />}
                      {stats.todayAttendance.status === 'absent' && <XCircle size={40} />}
                      {stats.todayAttendance.status === 'late' && <AlertCircle size={40} />}
                      {stats.todayAttendance.status === 'half_day' && <Sun size={40} />}
                      {!['present','absent','late','half_day'].includes(stats.todayAttendance.status) && <Clock size={40} />}
                    </div>
                    <h3 className="db-att-label">{stats.todayAttendance.status.replace('_', ' ')}</h3>
                    <div className="db-att-times">
                      {stats.todayAttendance.check_in_time && (
                        <div className="db-att-time-chip db-att-time-chip--in">
                          <span>CHECK IN</span>
                          <strong>{new Date(stats.todayAttendance.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                        </div>
                      )}
                      {stats.todayAttendance.check_out_time && (
                        <div className="db-att-time-chip db-att-time-chip--out">
                          <span>CHECK OUT</span>
                          <strong>{new Date(stats.todayAttendance.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="db-orb db-orb--missing">
                      <Clock size={40} />
                    </div>
                    <h3 className="db-att-label">Not Checked In</h3>
                    <p className="db-att-hint">Head to Attendance to mark today</p>
                  </>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div className="db-quick-links">
              <a href="/app/attendance" className="db-quick-link db-quick-link--purple">
                <Clock size={24} />
                <div><strong>Mark Attendance</strong><span>Check in / out now</span></div>
              </a>
              <a href="/app/leaves" className="db-quick-link db-quick-link--amber">
                <Calendar size={24} />
                <div><strong>Apply Leave</strong><span>Submit a new request</span></div>
              </a>
              <a href="/app/expenses" className="db-quick-link db-quick-link--green">
                <Receipt size={24} />
                <div><strong>Claim Expense</strong><span>File an expense claim</span></div>
              </a>
              <a href="/app/profile" className="db-quick-link db-quick-link--blue">
                <Award size={24} />
                <div><strong>My Profile</strong><span>Update your info</span></div>
              </a>
            </div>
          </div>

          {/* Leave Balance Chart */}
          <div className="db-leave-section glass-panel">
            <div className="db-chart-head"><Calendar size={18} /> Leave Balance Overview</div>
            {stats.leaveBalances?.length > 0 ? (
              <div style={{ padding: '1.5rem', paddingTop: '0.5rem' }}>
                <div className="db-leave-grid">
                  {stats.leaveBalances.map((leave, i) => {
                    const total = (leave.remaining_days || 0) + (leave.used_days || 0);
                    const pct = total > 0 ? Math.round(((leave.remaining_days || 0) / total) * 100) : 0;
                    return (
                      <div key={leave.leave_type_name} className="db-leave-item" style={{ '--clr': COLORS[i % COLORS.length] }}>
                        <div className="db-leave-item-top">
                          <span className="db-leave-type">{leave.leave_type_name}</span>
                          <span className="db-leave-count">{leave.remaining_days ?? 0} left</span>
                        </div>
                        <div className="db-leave-bar">
                          <div className="db-leave-bar-fill" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}></div>
                        </div>
                        <div className="db-leave-item-bot">
                          <span>{leave.used_days ?? 0} used</span>
                          <span>{pct}% remaining</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ height: '220px', marginTop: '1.5rem' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.leaveBalances} margin={{ top: 5, right: 10, left: -20, bottom: 5 }} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="leave_type_name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} itemStyle={{ color: '#f1f5f9' }} />
                      <Bar dataKey="remaining_days" name="Remaining" radius={[6, 6, 0, 0]}>
                        {stats.leaveBalances.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                      <Bar dataKey="used_days" name="Used" radius={[6, 6, 0, 0]} fill="rgba(248,113,113,0.35)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="db-empty-state"><Calendar size={48} /><p>No leave balances available</p></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

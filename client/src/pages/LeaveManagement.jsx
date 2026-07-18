import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import { Calendar as CalendarIcon, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import './LeaveManagement.css';

const LeaveManagement = () => {
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('my-leaves');
  const [balances, setBalances] = useState([]);
  const [history, setHistory] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: ''
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, [activeTab]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'my-leaves') {
        const [balRes, histRes, typesRes] = await Promise.all([
          api.get('/leaves/balance'),
          api.get('/leaves'),
          api.get('/admin/leave-types')
        ]);
        setBalances(balRes.data.data);
        setHistory(histRes.data.data);
        setLeaveTypes(typesRes.data.data);
      } else if (activeTab === 'approvals') {
        const reqRes = await api.get('/leaves/pending');
        setPendingRequests(reqRes.data.data);
      }
    } catch (error) {
      console.error('Error fetching leave data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      await api.post('/leaves', formData);
      setShowModal(false);
      setFormData({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
      fetchInitialData();
    } catch (error) {
      setFormError(error.response?.data?.message || 'Failed to submit leave request');
    }
  };

  const handleCancelLeave = async (id) => {
    if (window.confirm('Are you sure you want to cancel this leave request?')) {
      try {
        await api.put(`/leaves/${id}/cancel`);
        fetchInitialData();
      } catch (error) {
        alert('Failed to cancel leave request');
      }
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/leaves/${id}/approve`);
      fetchInitialData();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to approve');
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Enter rejection reason:');
    if (reason !== null) {
      try {
        await api.put(`/leaves/${id}/reject`, { rejection_reason: reason });
        fetchInitialData();
      } catch (error) {
        alert(error.response?.data?.message || 'Failed to reject');
      }
    }
  };

  if (isLoading && balances.length === 0 && pendingRequests.length === 0) {
    return <div className="page-container"><span className="spinner"></span></div>;
  }

  return (
    <div className="page-container">
      <div className="leave-dashboard">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'my-leaves' ? 'active' : ''}`}
            onClick={() => setActiveTab('my-leaves')}
          >
            My Leaves
          </button>
          {hasRole('admin') && (
            <button 
              className={`tab ${activeTab === 'approvals' ? 'active' : ''}`}
              onClick={() => setActiveTab('approvals')}
            >
              Pending Approvals
              {pendingRequests.length > 0 && <span className="badge">{pendingRequests.length}</span>}
            </button>
          )}
        </div>

        {activeTab === 'my-leaves' && (
          <div className="my-leaves-view">
            <div className="balances-grid">
              {balances.map(bal => (
                <div key={bal.id} className="balance-card glass-panel">
                  <div className="bal-header">
                    <h4>{bal.leave_type_name}</h4>
                    <CalendarIcon size={20} className="text-muted" />
                  </div>
                  <div className="bal-numbers">
                    <span className="remaining">{bal.remaining_days}</span>
                    <span className="total">/ {bal.total_days} days left</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${(bal.used_days / bal.total_days) * 100}%` }}
                    ></div>
                  </div>
                  <div className="bal-footer">
                    <span>Used: {bal.used_days}</span>
                  </div>
                </div>
              ))}
              
              <div className="balance-card apply-card glass-panel" onClick={() => setShowModal(true)}>
                <div className="apply-content">
                  <div className="plus-icon">+</div>
                  <h4>Apply for Leave</h4>
                </div>
              </div>
            </div>

            <div className="history-section glass-panel">
              <h3>Leave History</h3>
              <table className="data-table mt-3">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Duration</th>
                    <th>Days</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(req => (
                    <tr key={req.id}>
                      <td>{req.leave_type_name}</td>
                      <td>{new Date(req.start_date).toLocaleDateString()} to {new Date(req.end_date).toLocaleDateString()}</td>
                      <td>{req.total_days}</td>
                      <td className="truncate-text" title={req.reason}>{req.reason}</td>
                      <td>
                        <span className={`status-badge ${req.status}`}>
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        {req.status === 'pending' && (
                          <button className="btn-icon danger" onClick={() => handleCancelLeave(req.id)}>
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr><td colSpan="6" className="text-center">No leave history found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'approvals' && (
          <div className="approvals-view glass-panel">
            <h3>Pending Approvals</h3>
            <div className="requests-list mt-3">
              {pendingRequests.map(req => (
                <div key={req.id} className="request-card">
                  <div className="req-user">
                    <div className="avatar small">{req.first_name.charAt(0)}</div>
                    <div>
                      <h5>{req.first_name} {req.last_name}</h5>
                      <span className="dept">{req.department_name}</span>
                    </div>
                  </div>
                  <div className="req-details">
                    <div className="req-item">
                      <span className="label">Type:</span> {req.leave_type_name}
                    </div>
                    <div className="req-item">
                      <span className="label">Duration:</span> {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()} ({req.total_days} days)
                    </div>
                    <div className="req-item reason">
                      <span className="label">Reason:</span> {req.reason}
                    </div>
                  </div>
                  <div className="req-actions">
                    <button className="btn-success" onClick={() => handleApprove(req.id)}>
                      <CheckCircle2 size={16} /> Approve
                    </button>
                    <button className="btn-danger" onClick={() => handleReject(req.id)}>
                      <XCircle size={16} /> Reject
                    </button>
                  </div>
                </div>
              ))}
              {pendingRequests.length === 0 && (
                <div className="empty-state">
                  <CheckCircle2 size={40} className="text-muted" />
                  <p>No pending leave requests to approve.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Apply Leave Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Apply for Leave</h3>
                <button className="close-btn" onClick={() => setShowModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleApplyLeave} className="modal-body">
                {formError && <div className="error-alert mb-3"><AlertCircle size={16} /> {formError}</div>}
                
                <div className="input-group">
                  <label>Leave Type</label>
                  <select 
                    required 
                    value={formData.leave_type_id}
                    onChange={e => setFormData({...formData, leave_type_id: e.target.value})}
                  >
                    <option value="">Select Type</option>
                    {leaveTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-row">
                  <div className="input-group">
                    <label>Start Date</label>
                    <input 
                      type="date" 
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={formData.start_date}
                      onChange={e => setFormData({...formData, start_date: e.target.value})}
                    />
                  </div>
                  <div className="input-group">
                    <label>End Date</label>
                    <input 
                      type="date" 
                      required
                      min={formData.start_date || new Date().toISOString().split('T')[0]}
                      value={formData.end_date}
                      onChange={e => setFormData({...formData, end_date: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="input-group">
                  <label>Reason</label>
                  <textarea 
                    rows="3" 
                    required
                    value={formData.reason}
                    onChange={e => setFormData({...formData, reason: e.target.value})}
                    placeholder="Please provide a brief reason for your leave..."
                  ></textarea>
                </div>
                
                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Submit Request</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaveManagement;

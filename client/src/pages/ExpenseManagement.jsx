import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import { IndianRupee, Receipt, CheckCircle2, XCircle, AlertCircle, Upload, Eye } from 'lucide-react';
import './ExpenseManagement.css';

const ExpenseManagement = () => {
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('my-expenses');
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [pendingClaims, setPendingClaims] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    category_id: '',
    title: '',
    description: '',
    amount: '',
    expense_date: '',
    receipt: null
  });
  const [formError, setFormError] = useState('');

  // Receipt preview modal
  const [previewReceipt, setPreviewReceipt] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, [activeTab]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'my-expenses') {
        const [sumRes, histRes, catRes] = await Promise.all([
          api.get('/expenses/summary'),
          api.get('/expenses'),
          api.get('/admin/expense-categories')
        ]);
        setSummary(sumRes.data.data);
        setHistory(histRes.data.data);
        setCategories(catRes.data.data);
      } else if (activeTab === 'approvals') {
        const reqRes = await api.get('/expenses/pending');
        setPendingClaims(reqRes.data.data);
      }
    } catch (error) {
      console.error('Error fetching expense data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, receipt: e.target.files[0] });
    }
  };

  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    setFormError('');

    const form = new FormData();
    form.append('category_id', formData.category_id);
    form.append('title', formData.title);
    form.append('description', formData.description);
    form.append('amount', formData.amount);
    form.append('expense_date', formData.expense_date);
    if (formData.receipt) {
      form.append('receipt', formData.receipt);
    }

    try {
      await api.post('/expenses', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowModal(false);
      setFormData({ category_id: '', title: '', description: '', amount: '', expense_date: '', receipt: null });
      fetchInitialData();
    } catch (error) {
      setFormError(error.response?.data?.message || 'Failed to submit expense claim');
    }
  };

  const handleDeleteExpense = async (id) => {
    if (window.confirm('Are you sure you want to delete this expense claim?')) {
      try {
        await api.delete(`/expenses/${id}`);
        fetchInitialData();
      } catch (error) {
        alert('Failed to delete claim');
      }
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/expenses/${id}/approve`);
      fetchInitialData();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to approve');
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Enter rejection reason:');
    if (reason !== null) {
      try {
        await api.put(`/expenses/${id}/reject`, { rejection_reason: reason });
        fetchInitialData();
      } catch (error) {
        alert(error.response?.data?.message || 'Failed to reject');
      }
    }
  };

  const handleReimburse = async (id) => {
    if (window.confirm('Mark this expense as reimbursed?')) {
      try {
        await api.put(`/expenses/${id}/reimburse`);
        fetchInitialData();
      } catch (error) {
        alert(error.response?.data?.message || 'Failed to reimburse');
      }
    }
  };

  if (isLoading && !summary && pendingClaims.length === 0) {
    return <div className="page-container"><span className="spinner"></span></div>;
  }

  return (
    <div className="page-container">
      <div className="expense-dashboard">
        <div className="header-actions">
          <div className="tabs">
            <button 
              className={`tab ${activeTab === 'my-expenses' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-expenses')}
            >
              My Expenses
            </button>
            {hasRole('admin') && (
              <button 
                className={`tab ${activeTab === 'approvals' ? 'active' : ''}`}
                onClick={() => setActiveTab('approvals')}
              >
                Team Claims
                {pendingClaims.length > 0 && <span className="badge">{pendingClaims.length}</span>}
              </button>
            )}
          </div>
          {activeTab === 'my-expenses' && (
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              + New Expense
            </button>
          )}
        </div>

        {activeTab === 'my-expenses' && summary && (
          <div className="my-expenses-view">
            <div className="summary-grid">
              <div className="summary-card pending glass-panel">
                <div className="sum-icon"><IndianRupee size={24} /></div>
                <div className="sum-data">
                  <span className="label">Pending Approval</span>
                  <span className="value">₹{summary.pending_amount}</span>
                  <span className="count">{summary.pending_count} claims</span>
                </div>
              </div>
              <div className="summary-card approved glass-panel">
                <div className="sum-icon"><CheckCircle2 size={24} /></div>
                <div className="sum-data">
                  <span className="label">Approved (Awaiting Payment)</span>
                  <span className="value">₹{summary.approved_amount}</span>
                  <span className="count">{summary.approved_count} claims</span>
                </div>
              </div>
             
            </div>

          <div className="history-section glass-panel ">
              <h3>Expense History</h3>
              <table className="data-table mt-3">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Title</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Receipt</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(claim => (
                    <tr key={claim.id}>
                      <td>{new Date(claim.expense_date).toLocaleDateString()}</td>
                      <td>{claim.category_name}</td>
                      <td>{claim.title}</td>
                      <td>₹{claim.amount}</td>
                      <td>
                        <span className={`status-badge ${claim.status}`}>
                          {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        {claim.receipt_url ? (
                          <button className="btn-icon info" onClick={() => setPreviewReceipt(`http://localhost:5000${claim.receipt_url}`)}>
                            <Eye size={16} /> View
                          </button>
                        ) : '-'}
                      </td>
                      <td>
                        {claim.status === 'pending' && (
                          <button className="btn-icon danger" onClick={() => handleDeleteExpense(claim.id)}>
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr><td colSpan="7" className="text-center">No expense claims found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'approvals' && (
          <div className="approvals-view glass-panel">
            <h3>Pending Expense Claims</h3>
            <div className="claims-list mt-3">
              {pendingClaims.map(claim => (
                <div key={claim.id} className="claim-card">
                  <div className="claim-header">
                    <div className="claim-user">
                      <div className="avatar small">{claim.first_name.charAt(0)}</div>
                      <div>
                        <h5>{claim.first_name} {claim.last_name}</h5>
                        <span className="dept">{claim.department_name}</span>
                      </div>
                    </div>
                    <div className="claim-amount">
                      ₹{claim.amount}
                    </div>
                  </div>
                  
                  <div className="claim-body">
                    <div className="claim-details">
                      <div className="detail-row"><span className="label">Category:</span> {claim.category_name}</div>
                      <div className="detail-row"><span className="label">Date:</span> {new Date(claim.expense_date).toLocaleDateString()}</div>
                      <div className="detail-row"><span className="label">Title:</span> {claim.title}</div>
                      {claim.description && <div className="detail-row desc"><span className="label">Desc:</span> {claim.description}</div>}
                    </div>
                    {claim.receipt_url && (
                      <div className="claim-receipt">
                        <button className="btn-secondary sm" onClick={() => setPreviewReceipt(`http://localhost:5000${claim.receipt_url}`)}>
                          <Eye size={14} /> View Receipt
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="claim-actions">
                    <button className="btn-success" onClick={() => handleApprove(claim.id)}>
                      <CheckCircle2 size={16} /> Approve
                    </button>
                    <button className="btn-danger" onClick={() => handleReject(claim.id)}>
                      <XCircle size={16} /> Reject
                    </button>
                  </div>
                </div>
              ))}
              {pendingClaims.length === 0 && (
                <div className="empty-state">
                  <CheckCircle2 size={40} className="text-muted" />
                  <p>No pending expense claims to approve.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create Expense Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Submit Expense Claim</h3>
                <button className="close-btn" onClick={() => setShowModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleSubmitExpense} className="modal-body">
                {formError && <div className="error-alert mb-3"><AlertCircle size={16} /> {formError}</div>}
                
                <div className="form-row">
                  <div className="input-group">
                    <label>Category</label>
                    <select required value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Date</label>
                    <input type="date" required max={new Date().toISOString().split('T')[0]} value={formData.expense_date} onChange={e => setFormData({...formData, expense_date: e.target.value})} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="input-group">
                    <label>Title</label>
                    <input type="text" required placeholder="E.g. Client lunch" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label>Amount (₹)</label>
                    <input type="number" required min="1" step="0.01" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                  </div>
                </div>
                
                <div className="input-group">
                  <label>Description (Optional)</label>
                  <textarea rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
                </div>

                <div className="input-group">
                  <label>Receipt Upload</label>
                  <div className="file-upload-wrapper">
                    <input type="file" id="receipt-upload" accept="image/*,.pdf" onChange={handleFileChange} />
                    <label htmlFor="receipt-upload" className="file-upload-btn">
                      <Upload size={18} /> {formData.receipt ? formData.receipt.name : 'Choose a file...'}
                    </label>
                  </div>
                </div>
                
                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Submit Claim</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Receipt Preview Modal */}
        {previewReceipt && (
          <div className="modal-overlay" onClick={() => setPreviewReceipt(null)}>
            <div className="modal-content preview-modal glass-panel" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Receipt Preview</h3>
                <button className="close-btn" onClick={() => setPreviewReceipt(null)}>&times;</button>
              </div>
              <div className="modal-body preview-body">
                {previewReceipt.endsWith('.pdf') ? (
                  <iframe src={previewReceipt} width="100%" height="500px" title="Receipt PDF"></iframe>
                ) : (
                  <img src={previewReceipt} alt="Receipt Preview" className="receipt-img" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseManagement;

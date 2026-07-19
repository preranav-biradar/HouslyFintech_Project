import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { Mail, ArrowRight, ShieldCheck, CheckCircle2, ExternalLink } from 'lucide-react';
import './Login.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mockEmailData, setMockEmailData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await api.post('/auth/forgot-password', { email });
      if (response.data.success) {
        if (response.data.previewUrl) {
          setMockEmailData(response.data.previewUrl);
        } else {
          setMockEmailData('sent');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        
        {/* Left Info Panel */}
        <div className="login-info">
          <h2>Forgot Password?</h2>
          <p>
            Don't worry! It happens. Enter your email address and we'll send you a link to reset your password.
          </p>
          
          <div className="feature-list" style={{ marginTop: '2rem' }}>
            <div className="feature-item">
              <div className="feature-icon"><ShieldCheck size={20} color="#a78bfa" /></div>
              <span>Secure password reset process</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><Mail size={20} color="#60a5fa" /></div>
              <span>Instant email delivery</span>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="login-form-section">
          <h3>Reset Password</h3>
          <p>Enter the email associated with your account</p>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-container">
                <Mail size={18} className="input-icon" />
                <input 
                  type="email" 
                  id="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="login-submit-btn"
              disabled={isSubmitting || !email}
            >
              {isSubmitting ? 'Sending Link...' : 'Send Reset Link'}
              {!isSubmitting && <ArrowRight size={18} />}
            </button>
          </form>

          {mockEmailData && (
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                <CheckCircle2 size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', color: '#10b981' }} /> Email sent successfully!
              </p>
              {typeof mockEmailData === 'string' && mockEmailData.startsWith('http') && (
                <a href={mockEmailData} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '0.5rem 1rem', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
                  Open Ethereal Mail Inbox <ExternalLink size={16} />
                </a>
              )}
            </div>
          )}

          <div className="signup-redirect">
            Remember your password? 
            <Link to="/login">Sign in here</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

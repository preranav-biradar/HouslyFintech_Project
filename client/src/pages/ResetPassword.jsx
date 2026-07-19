import React, { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { Lock, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import './Login.css'; // Reuse sleek login layout

const ResetPassword = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.post('/auth/reset-password', {
        email,
        token,
        newPassword: password
      });
      
      if (response.data.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        
        {/* Left Info Panel */}
        <div className="login-info">
          <h2>Set New Password</h2>
          <p>
            Create a strong, new password for your account to ensure your data remains secure.
          </p>
          
          <div className="feature-list" style={{ marginTop: '2rem' }}>
            <div className="feature-item">
              <div className="feature-icon"><ShieldCheck size={20} color="#34d399" /></div>
              <span>Encrypted and secured</span>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="login-form-section">
          <h3>Reset Password</h3>
          <p>Enter your new password below</p>

          {error && <div className="error-message">{error}</div>}
          {success && (
            <div className="success-message" style={{ 
              background: 'rgba(52, 211, 153, 0.1)', 
              color: '#34d399', 
              padding: '1rem', 
              borderRadius: '0.75rem', 
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              border: '1px solid rgba(52, 211, 153, 0.2)'
            }}>
              <CheckCircle2 size={18} /> Password reset successfully! Redirecting...
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="password">New Password</label>
                <div className="input-container">
                  <Lock size={18} className="input-icon" />
                  <input 
                    type="password" 
                    id="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="input-container">
                  <Lock size={18} className="input-icon" />
                  <input 
                    type="password" 
                    id="confirmPassword" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="login-submit-btn"
                disabled={isSubmitting || !password || !confirmPassword}
              >
                {isSubmitting ? 'Resetting...' : 'Reset Password'}
                {!isSubmitting && <ArrowRight size={18} />}
              </button>
            </form>
          )}

          <div className="signup-redirect">
            Back to <Link to="/login">Login</Link>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default ResetPassword;

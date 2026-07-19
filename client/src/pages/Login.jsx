import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LogIn, Mail, Lock, Building, Users, Activity } from 'lucide-react';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await login(email, password);

    if (result.success) {
      navigate('/app');
    } else {
      setError(result.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">

        {/* Left Info Panel */}
        <div className="login-info">
          <h2>Welcome Back</h2>
          <p>
            Log in to Hously EMS to manage your attendance, track leaves, and handle expense claims all in one place.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <div className="feature-icon"><Activity size={20} color="#60a5fa" /></div>
              <span>Real-time Dashboard Analytics</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><Building size={20} color="#34d399" /></div>
              <span>Department & Role Management</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><Users size={20} color="#a78bfa" /></div>
              <span>Seamless Team Collaboration</span>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="login-form-section">
          <h3>Sign in</h3>
          <p>Enter your credentials to access your account</p>

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

            <div className="form-group">
              <label htmlFor="password" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Password</span>
                <Link to="/forgot-password" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 500 }}>Forgot password?</Link>
              </label>
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

            <button
              type="submit"
              className="login-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
              {!isSubmitting && <LogIn size={18} />}
            </button>
          </form>

          <div className="signup-redirect">
            New employee?
            <Link to="/signup">Sign up here</Link>
          </div>

          {/* <div className="hint-message">
            Default Admin: admin@company.com / Admin@123
          </div> */}
        </div>

      </div>
    </div>
  );
};

export default Login;

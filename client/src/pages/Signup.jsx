import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { User, Mail, Lock, Phone, ArrowRight, CheckCircle2, ShieldCheck, Clock, Layers } from 'lucide-react';
import './Signup.css';

const Signup = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const response = await api.post('/auth/signup', {
        first_name: firstName,
        last_name: lastName,
        email,
        password,
        phone,
      });

      if (response.data.success) {
        setSuccess('Signup successful. Please login to continue.');
        setFirstName('');
        setLastName('');
        setEmail('');
        setPassword('');
        setPhone('');
        setTimeout(() => navigate('/login'), 1500);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed, please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-container">
        
        {/* Left Info Panel */}
        <div className="signup-info">
          <h2>Join Hously EMS</h2>
          <p>
            Experience a modern workforce management platform designed to simplify your daily operations and keep you connected.
          </p>
          
          <div className="feature-list">
            <div className="feature-item">
              <div className="feature-icon"><Clock size={20} color="#60a5fa" /></div>
              <span>GPS & Selfie Attendance</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><Layers size={20} color="#34d399" /></div>
              <span>Easy Leave Management</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><ShieldCheck size={20} color="#a78bfa" /></div>
              <span>Secure Expense Claims</span>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="signup-form-section">
          <h3>Create your account</h3>
          <p>Fill in your details to get started</p>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message"><CheckCircle2 size={18} /> {success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="signup-grid">
              
              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <div className="input-container">
                  <User size={18} className="input-icon" />
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <div className="input-container">
                  <User size={18} className="input-icon" />
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label htmlFor="email">Email Address</label>
                <div className="input-container">
                  <Mail size={18} className="input-icon" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label htmlFor="password">Password</label>
                <div className="input-container">
                  <Lock size={18} className="input-icon" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label htmlFor="phone">Phone Number (Optional)</label>
                <div className="input-container">
                  <Phone size={18} className="input-icon" />
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>

            </div>

            <button type="submit" className="signup-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
              {!isSubmitting && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="login-redirect">
            Already have an account? 
            <Link to="/login">Sign in here</Link>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Signup;

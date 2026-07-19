import React, { useState, useEffect } from 'react';
import { User, Phone, Image as ImageIcon, Save, Loader2, Briefcase } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import './Profile.css';

const Profile = () => {
  const { user, hasRole } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    department_id: '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/admin/departments');
      setDepartments(res.data.data || []);
    } catch (error) {
      console.error('Error fetching departments', error);
    }
  };

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone: user.phone || '',
        department_id: user.department_id || '',
      });
      setAvatarPreview(user.avatar_url || '');
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const submitData = new FormData();
      submitData.append('first_name', formData.first_name);
      submitData.append('last_name', formData.last_name);
      submitData.append('phone', formData.phone);
      if (formData.department_id) {
        submitData.append('department_id', formData.department_id);
      }
      if (avatarFile) {
        submitData.append('avatar', avatarFile);
      } else if (avatarPreview && typeof avatarPreview === 'string') {
        submitData.append('avatar_url', avatarPreview);
      }

      const res = await api.put('/employees/profile', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setMessage({ type: 'success', text: res.data.message || 'Profile updated successfully!' });
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to update profile'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="profile-wrapper glass-panel">
        <div className="profile-header">
          <div className="avatar-large">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Profile" />
            ) : (
              <span>{formData.first_name?.charAt(0) || 'U'}</span>
            )}
          </div>
          <div className="profile-title">
            <h2>{user?.first_name} {user?.last_name}</h2>
            <span className="badge-pill bg-tertiary">{user?.designation || user?.role_name}</span>
            <span className="badge-pill bg-tertiary ml-2">
              {hasRole('super_admin') ? 'Human Resources' : user?.department_name || ''}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="profile-form">
          {message.text && (
            <div className={`alert ${message.type}`}>
              {message.text}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label><User size={16} /> First Name</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                className="input-field"
              />
            </div>
            <div className="form-group">
              <label><User size={16} /> Last Name</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
                className="input-field"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label><Phone size={16} /> Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="input-field"
                placeholder="+91-0000000000"
              />
            </div>
            {!hasRole('admin') && !hasRole('super_admin') && (
              <div className="form-group">
                <label><Briefcase size={16} /> Department</label>
                <select
                  name="department_id"
                  value={formData.department_id}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="form-row">
             <div className="form-group">
              <label><ImageIcon size={16} /> Upload Avatar (Photo)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="input-field"
                style={{ padding: '0.5rem' }}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;

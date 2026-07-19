import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import WebcamCapture from '../components/attendance/WebcamCapture';
import { Clock, CheckCircle, XCircle, CalendarDays } from 'lucide-react';
import './Attendance.css'; // Simple css for this page

const Attendance = () => {
  const [todayStatus, setTodayStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWebcam, setShowWebcam] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [history, setHistory] = useState([]);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    fetchTodayStatus();
    fetchHistory();
  }, []);

  const fetchTodayStatus = async () => {
    try {
      const res = await api.get('/attendance/today');
      if (res.data.success) {
        setTodayStatus(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching today status', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/attendance/history?limit=5');
      if (res.data.success) {
        setHistory(res.data.data.records);
      }
    } catch (error) {
      console.error('Error fetching history', error);
    }
  };

  const handleCapture = async (data) => {
    setActionError('');
    try {
      const endpoint = data.isCheckOut ? '/attendance/check-out' : '/attendance/check-in';
      const res = await api.post(endpoint, {
        selfie_base64: data.selfieBase64,
        latitude: data.latitude,
        longitude: data.longitude
      });

      if (res.data.success) {
        setShowWebcam(false);
        fetchTodayStatus();
        fetchHistory();
      }
    } catch (error) {
      setActionError(error.response?.data?.message || 'An error occurred during submission');
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '--:--';
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return <div className="page-container"><span className="spinner"></span></div>;
  }

  return (
    <div className="page-container">
      <div className="attendance-dashboard">
        {/* Today's Status Card */}
        <div className="status-card glass-panel">
          <h3>Today's Attendance</h3>
          
          <div className="time-display">
            <div className="time-block">
              <span className="label">Check In</span>
              <span className="time">{todayStatus ? formatTime(todayStatus.check_in_time) : '--:--'}</span>
            </div>
            <div className="time-divider"></div>
            <div className="time-block">
              <span className="label">Check Out</span>
              <span className="time">{todayStatus?.check_out_time ? formatTime(todayStatus.check_out_time) : '--:--'}</span>
            </div>
          </div>

          <div className="status-info">
            {todayStatus ? (
              <span className={`status-badge ${todayStatus.status}`}>
                Status: {todayStatus.status.replace('_', ' ').toUpperCase()}
              </span>
            ) : (
              <span className="status-badge absent">Not Checked In</span>
            )}
            
            {todayStatus && (
              <span className={`geofence-badge ${todayStatus.is_within_geofence ? 'in' : 'out'}`}>
                {todayStatus.is_within_geofence ? 'Inside Geofence' : 'Outside Geofence'}
              </span>
            )}
          </div>

          <div className="action-area">
            {!showWebcam ? (
              <>
                {!todayStatus ? (
                  <button className="btn-primary" onClick={() => { setIsCheckingOut(false); setShowWebcam(true); }}>
                    <Clock size={18} /> Check In Now
                  </button>
                ) : !todayStatus.check_out_time ? (
                  <button className="btn-primary" onClick={() => { setIsCheckingOut(true); setShowWebcam(true); }}>
                    <Clock size={18} /> Check Out
                  </button>
                ) : (
                  <div className="completed-msg">
                    <CheckCircle size={18} color="var(--success)" />
                    Attendance completed for today
                  </div>
                )}
              </>
            ) : (
              <button className="btn-secondary cancel-btn" onClick={() => { setShowWebcam(false); setActionError(''); }}>
                Cancel
              </button>
            )}
          </div>
          
          {actionError && <div className="error-alert mt-3">{actionError}</div>}
        </div>

        {/* Webcam Area */}
        {showWebcam && (
          <div className="webcam-section">
            <WebcamCapture onCapture={handleCapture} isCheckOut={isCheckingOut} />
          </div>
        )}

        {/* Recent History */}
        <div className="history-section glass-panel">
          <div className="section-header">
            <h3><CalendarDays size={20} /> Recent History</h3>
          </div>
          
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.length > 0 ? history.map((record) => (
                <tr key={record.id}>
                  <td>{new Date(record.date).toLocaleDateString()}</td>
                  <td>{formatTime(record.check_in_time)}</td>
                  <td>{formatTime(record.check_out_time)}</td>
                  <td>{record.total_hours || '-'}</td>
                  <td>
                    <span className={`status-dot ${record.status}`}></span>
                    {record.status.replace('_', ' ')}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="text-center">No recent records found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Attendance;

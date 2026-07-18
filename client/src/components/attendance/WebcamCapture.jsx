import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, CheckCircle2, MapPin } from 'lucide-react';
import './WebcamCapture.css';

const WebcamCapture = ({ onCapture, isCheckOut = false }) => {
  const webcamRef = useRef(null);
  const [imgSrc, setImgSrc] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    // Get GPS coordinates
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLocationError('');
        },
        (error) => {
          console.error('Error getting location:', error);
          setLocationError('Location access is required for attendance.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationError('Geolocation is not supported by your browser.');
    }
  }, []);

  const capture = useCallback(() => {
    if (countdown !== null) return;
    
    // Start countdown
    setCountdown(3);
    
    const timerId = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerId);
          const imageSrc = webcamRef.current.getScreenshot();
          setImgSrc(imageSrc);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    
  }, [webcamRef, countdown]);

  const retake = () => {
    setImgSrc(null);
  };

  const handleSubmit = () => {
    if (!imgSrc) {
      setLocationError('Please capture a selfie before submitting attendance.');
      return;
    }

    if (!location) {
      setLocationError('Location is still being detected. Please wait a moment and try again.');
      return;
    }

    onCapture({
      selfieBase64: imgSrc,
      latitude: location.latitude,
      longitude: location.longitude,
      isCheckOut,
    });
  };

  return (
    <div className="webcam-container glass-panel">
      <div className="webcam-header">
        <h3>{isCheckOut ? 'Check Out' : 'Check In'} Verification</h3>
        <p>Please take a selfie to confirm your attendance.</p>
      </div>
      
      {locationError && (
        <div className="error-alert location-error">
          <MapPin size={18} /> {locationError}
        </div>
      )}

      {!locationError && !location && (
        <div className="info-alert">
          <span className="spinner small"></span>
          Acquiring GPS location...
        </div>
      )}

      <div className="camera-box">
        {imgSrc ? (
          <img src={imgSrc} alt="captured selfie" className="captured-image" />
        ) : (
          <div className="webcam-wrapper">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "user" }}
              className="webcam-video"
            />
            {countdown !== null && (
              <div className="countdown-overlay">
                <span>{countdown}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="webcam-actions">
        {imgSrc ? (
          <>
            <button className="btn-secondary" onClick={retake}>
              <RefreshCw size={18} /> Retake
            </button>
            <button 
              className="btn-primary" 
              onClick={handleSubmit}
              disabled={!location}
            >
              <CheckCircle2 size={18} /> Submit
            </button>
          </>
        ) : (
          <button 
            className="btn-primary capture-btn" 
            onClick={capture}
            disabled={countdown !== null || !location}
          >
            <Camera size={18} /> 
            {countdown !== null ? 'Capturing...' : 'Capture Selfie'}
          </button>
        )}
      </div>
      
      {location && (
        <div className="location-info">
          <MapPin size={14} />
          <span>Coordinates: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</span>
        </div>
      )}
    </div>
  );
};

export default WebcamCapture;

import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Bell, Search, Menu } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const Topbar = ({ toggleSidebar }) => {
  const { user } = useAuth();
  const location = useLocation();
  
  // Format the path to a page title
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    const title = path.replace('/', '').replace('-', ' ');
    return title.charAt(0).toUpperCase() + title.slice(1);
  };

  return (
    <header className="topbar glass-panel">
      <div className="topbar-left">
        <button className="mobile-toggle" onClick={toggleSidebar}>
          <Menu size={24} />
        </button>
        <h1 className="page-title">{getPageTitle()}</h1>
      </div>

      <div className="topbar-right">
     
        
        <div className="profile-dropdown">
          <Link to="/app/profile" className="avatar-link" title="Profile">
            {user?.avatar_url ? (
              <div className="avatar small"><img src={user.avatar_url} alt="User" style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} /></div>
            ) : (
              <div className="avatar small">{user?.first_name?.charAt(0) || 'U'}</div>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Topbar;

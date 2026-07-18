import React from 'react';
import { useLocation } from 'react-router-dom';
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
          <div className="avatar small">{user?.first_name?.charAt(0)}</div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;

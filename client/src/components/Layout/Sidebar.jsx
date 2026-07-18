import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard,
  Clock,
  Calendar,
  Receipt,
  Settings,
  LogOut,
  ChevronLeft,
  AlertTriangle
} from 'lucide-react';

import { useState } from 'react';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const { user, logout, hasRole } = useAuth();

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const menuItems = [
    { path: '/app', name: 'Dashboard', icon: LayoutDashboard },
    { path: '/app/attendance', name: 'Attendance', icon: Clock },
    { path: '/app/leaves', name: 'Leaves', icon: Calendar },
    { path: '/app/expenses', name: 'Expenses', icon: Receipt },
  ];

  if (hasRole('admin')) {
    menuItems.push({ path: '/app/admin', name: 'Admin Panel', icon: Settings });
  }

  return (
    <>
    <aside className={`sidebar glass-panel ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        {isOpen && <h2 className="text-gradient">Hously EMS</h2>}
        <button className="toggle-btn" onClick={() => setIsOpen(!isOpen)}>
          <ChevronLeft className={`icon-transition ${!isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink 
              key={item.path} 
              to={item.path} 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={!isOpen ? item.name : ''}
            >
              <Icon size={20} />
              {isOpen && <span>{item.name}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {isOpen && (
          <div className="user-info">
            <div className="avatar">{user?.first_name?.charAt(0)}</div>
            <div className="user-details">
              <span className="user-name">{user?.first_name} {user?.last_name}</span>
              <span className="user-role">{user?.designation || user?.role_name}</span>
            </div>
          </div>
        )}
        <button
  className="logout-btn"
  onClick={() => setShowLogoutModal(true)}
  title={!isOpen ? "Logout" : ""}
>
  <LogOut size={20} />
  {isOpen && <span>Logout</span>}
</button>
      </div>
      {/* modal intentionally rendered outside the aside so fixed overlay centers correctly */}
    </aside>
    {showLogoutModal && (
      <div
        className="logout-modal-overlay"
        onClick={() => setShowLogoutModal(false)}
      >
        <div
          className="logout-modal glass-panel"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="logout-icon">
            <AlertTriangle size={34} />
          </div>

          <h3>Confirm Logout</h3>

          <p>
            Are you sure you want to logout from your account?
          </p>

          <div className="logout-actions">
            <button
              className="cancel-btn"
              onClick={() => setShowLogoutModal(false)}
            >
              Cancel
            </button>

            <button
              className="confirm-btn"
              onClick={() => {
                setShowLogoutModal(false);
                logout();
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default Sidebar;

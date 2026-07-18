import React, { createContext, useState, useEffect } from 'react';
import api from '../api/axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const checkAuth = async () => {
      try {
        const response = await api.get('/auth/me');
        if (!active) return;
        if (response.data.success) {
          setUser(response.data.data);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        if (!active) return;
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      active = false;
    };
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.data.success) {
        setUser(response.data.data.user);
        setIsAuthenticated(true);
        return { success: true };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Login failed' 
      };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const hasRole = (...roles) => {
    const roleName = user?.role_name;
    if (!roleName) return false;

    if (roleName === 'super_admin') {
      return roles.includes('super_admin') || roles.includes('admin');
    }

    return roles.includes(roleName);
  };

  const isAdmin = () => hasRole('admin') || hasRole('super_admin');

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout, hasRole, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

/* eslint-disable react-refresh/only-export-components */
import { createContext, useState } from 'react';
import { API_BASE_URL } from '../config';

export const AuthContext = createContext(null);

const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    const t = localStorage.getItem('token');
    if (t) {
      const decoded = decodeToken(t);
      if (decoded && decoded.exp * 1000 > Date.now()) {
        return t;
      }
      localStorage.removeItem('token');
    }
    return null;
  });

  const [user, setUser] = useState(() => {
    const t = localStorage.getItem('token');
    if (t) {
      const decoded = decodeToken(t);
      if (decoded && decoded.exp * 1000 > Date.now()) {
        return decoded;
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(false);

  const logout = async () => {
    setLoading(true);
    try {
      if (token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }).catch(() => {});
      }
    } finally {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    setLoading(true);
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await fetch(`${API_BASE_URL}/auth/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      setLoading(false);
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Credenciales incorrectas o error en el servidor');
    }

    const data = await response.json();
    const accessToken = data.access_token;
    
    localStorage.setItem('token', accessToken);
    setToken(accessToken);
    
    const decoded = decodeToken(accessToken);
    setUser(decoded);
    setLoading(false);
    return decoded;
  };

  const authenticatedFetch = async (url, options = {}) => {
    const headers = {
      ...options.headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, {
      ...options,
      headers,
    });
  };

  const value = {
    token,
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.roles?.includes('Admin') || false,
    login,
    logout,
    authenticatedFetch,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

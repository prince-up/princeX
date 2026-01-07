import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, deviceAPI } from '../services/api';
import socketService from '../services/socket';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await authAPI.getProfile();
          setUser(response.data.user);
          await registerDevice();
          socketService.connect();
        } catch (error) {
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const registerDevice = async () => {
    try {
      const deviceFingerprint = getDeviceFingerprint();
      const deviceName = getDeviceName();
      const userAgent = navigator.userAgent;

      const response = await deviceAPI.register({
        deviceFingerprint,
        deviceName,
        userAgent,
      });

      setDevice(response.data.device);
      localStorage.setItem('deviceId', response.data.device._id);
    } catch (error) {
      console.error('Device registration failed:', error);
    }
  };

  const getDeviceFingerprint = () => {
    let fingerprint = localStorage.getItem('deviceFingerprint');
    if (!fingerprint) {
      fingerprint = `${navigator.userAgent}-${Date.now()}-${Math.random()}`;
      localStorage.setItem('deviceFingerprint', fingerprint);
    }
    return fingerprint;
  };

  const getDeviceName = () => {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    let os = 'Unknown';

    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';

    return `${browser} on ${os}`;
  };

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    localStorage.setItem('token', response.data.token);
    setUser(response.data.user);
    await registerDevice();
    socketService.connect();
  };

  const register = async (email, password, fullName) => {
    const response = await authAPI.register({ email, password, fullName });
    localStorage.setItem('token', response.data.token);
    setUser(response.data.user);
    await registerDevice();
    socketService.connect();
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('deviceId');
    setUser(null);
    setDevice(null);
    socketService.disconnect();
  };

  const value = {
    user,
    device,
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

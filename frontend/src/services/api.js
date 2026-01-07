import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/profile'),
  logout: () => api.post('/auth/logout'),
};

export const deviceAPI = {
  register: (data) => api.post('/device/register', data),
  list: () => api.get('/device/list'),
  updateStatus: (deviceId, isOnline) => 
    api.patch(`/device/${deviceId}/status`, { isOnline }),
};

export const sessionAPI = {
  createInstant: (data) => api.post('/session/instant', data),
  join: (data) => api.post('/session/join', data),
  connectPermanent: (data) => api.post('/session/permanent', data),
  end: (sessionId) => api.delete(`/session/${sessionId}`),
  getActive: () => api.get('/session/active'),
};

export const trustAPI = {
  add: (data) => api.post('/trust/add', data),
  list: () => api.get('/trust/list'),
  revoke: (trustId) => api.delete(`/trust/${trustId}`),
  getAvailableDevices: () => api.get('/trust/available-devices'),
};

export const iceServersAPI = {
  get: () => api.get('/ice-servers'),
};

export default api;

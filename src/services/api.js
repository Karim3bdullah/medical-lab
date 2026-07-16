import axios from 'axios';

const API = axios.create({
  baseURL: 'https://labnet.ruaada.com/api/v1',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15000,
  withCredentials: false,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const hasExplicitAuthorization = Boolean(config.headers?.Authorization);

  if (token && !hasExplicitAuthorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      ['isAuthenticated', 'userName', 'userRole', 'tenantSlug'].forEach((key) =>
        localStorage.removeItem(key),
      );

      const isPlatformPath = window.location.pathname.startsWith('/master-admin');
      const target = isPlatformPath ? '/super-login' : '/login';

      if (window.location.pathname !== target) {
        window.location.href = target;
      }
    }

    return Promise.reject(error);
  },
);

export default API;

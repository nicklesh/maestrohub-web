import axios from 'axios';
import { Platform } from 'react-native';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export const getBaseUrl = () => `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  // Note: withCredentials removed to avoid CORS issues with wildcard origins
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - could redirect to login
      console.log('Unauthorized request');
    }
    return Promise.reject(error);
  }
);

export default api;

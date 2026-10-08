import axios, { type AxiosInstance } from 'axios';

// If you already have an axios instance elsewhere (e.g. used by auth/contacts),
// delete this file and just fix the import path in services.ts to point to
// your existing one instead.
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  withCredentials: true, // sends the httpOnly auth cookies your backend's `protect` middleware expects
});

export default api;
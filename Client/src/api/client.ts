import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // send refresh-token cookie
  headers: { 'Content-Type': 'application/json' },
});

// ── Token helpers ──────────────────────────────────────────────────────────────
const ACCESS_TOKEN_KEY = 'engageo_access_token';

export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const setAccessToken = (token: string) => localStorage.setItem(ACCESS_TOKEN_KEY, token);
export const clearAccessToken = () => localStorage.removeItem(ACCESS_TOKEN_KEY);

// ── Request interceptor: attach Bearer token ───────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Endpoints whose own 401s mean "bad credentials" / "not logged in yet" —
// never worth retrying via /auth/refresh, since there's no session to
// refresh. Without this, a wrong-password login attempt would 401, trigger
// a refresh attempt (which has no cookie to use), and the user would see
// the refresh endpoint's "No refresh token provided" message instead of
// the actual "Invalid credentials" error.
const AUTH_ENDPOINTS_TO_SKIP = ['/auth/login', '/auth/register', '/auth/refresh'];

// ── Response interceptor: refresh on 401 ──────────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    const shouldSkipRefresh = AUTH_ENDPOINTS_TO_SKIP.some((path) =>
      originalRequest.url?.includes(path),
    );

    if (error.response?.status === 401 && !originalRequest._retry && !shouldSkipRefresh) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post<{ accessToken: string }>('/auth/refresh');
        setAccessToken(data.accessToken);
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAccessToken();
        // No hard redirect here either — reject and let route guards in App.tsx handle it
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Either not a 401, already retried, or this is a login/register/refresh
    // call — in all these cases just bubble up the original error untouched
    // so the caller (e.g. LoginPage) sees the real "Invalid credentials"
    // message instead of a refresh-flow error.
    if (shouldSkipRefresh && error.response?.status === 401 && originalRequest.url?.includes('/auth/refresh')) {
      clearAccessToken();
    }

    return Promise.reject(error);
  },
);

// ── Custom event for plan limit errors ────────────────────────────────────────
// When a 403 with a usage-limit error comes back, emit a browser custom event
// so the UpgradeModalProvider can intercept it without tight coupling.
api.interceptors.response.use(
  r => r,
  (error: AxiosError<any>) => {
    if (error.response?.status === 403) {
      const errBody = error.response.data as any;
      const limitErrors = errBody?.errors;
      if (Array.isArray(limitErrors) && limitErrors.length > 0) {
        const info = limitErrors[0];
        window.dispatchEvent(new CustomEvent('engageo:plan-limit', { detail: {
          resource: info.resource,
          used: info.used,
          limit: info.limit,
          plan: info.plan,
          message: errBody.message,
        }}));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
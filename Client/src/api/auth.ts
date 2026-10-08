import api from './client';

export interface LoginPayload { email: string; password: string; }
export interface RegisterPayload { name: string; email: string; password: string; }
export interface ForgotPasswordPayload { email: string; }
export interface ResetPasswordPayload { token: string; password: string; confirmPassword: string; }

export interface AuthUser {
  _id: string;
  id?: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  status: string;
  isEmailVerified: boolean;
}

export interface AuthResponse {
  success: boolean;
  accessToken: string;
  user: AuthUser;
  message?: string;
}

export const authApi = {
  login: (data: LoginPayload) =>
    api.post<AuthResponse>('/auth/login', data).then(r => r.data),

  register: (data: RegisterPayload) =>
    api.post<AuthResponse>('/auth/register', data).then(r => r.data),

  logout: () =>
    api.post('/auth/logout').then(r => r.data),

  getMe: () =>
    api.get<{ success: boolean; user: AuthUser }>('/auth/me').then(r => r.data),

  forgotPassword: (data: ForgotPasswordPayload) =>
    api.post('/auth/forgot-password', data).then(r => r.data),

  resetPassword: (data: ResetPasswordPayload) =>
    api.post('/auth/reset-password', data).then(r => r.data),

  changePassword: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    api.post('/auth/change-password', data).then(r => r.data),

  refresh: () =>
    api.post<{ accessToken: string }>('/auth/refresh').then(r => r.data),

  verifyEmail: (token: string) =>
    api.get<{ success: boolean; message: string }>(`/auth/verify-email?token=${token}`).then(r => r.data),

  resendVerification: (email: string) =>
    api.post<{ success: boolean; message: string }>('/auth/resend-verification', { email }).then(r => r.data),
};
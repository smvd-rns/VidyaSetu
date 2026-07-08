import { api, setAccessToken } from './api';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  globalRole: 'SUPER_ADMIN' | 'USER';
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  expiresIn: string;
}

export async function login(email: string, password: string) {
  const data = await api<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(data.accessToken);
  return data;
}

export async function register(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  joinCode?: string;
  batchId?: string;
}) {
  const data = await api<LoginResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  setAccessToken(data.accessToken);
  return data;
}

export async function logout() {
  await api('/auth/logout', { method: 'POST' });
  setAccessToken(null);
}

export async function getMe() {
  return api<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    globalRole: string;
    centerMemberships: Array<{
      role: string;
      center: { id: string; name: string; slug: string; status: string };
    }>;
  }>('/auth/me');
}

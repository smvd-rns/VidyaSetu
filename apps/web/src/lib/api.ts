function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
}

// Keep API_URL as a lazy getter for backwards compatibility
export const API_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : 'http://localhost:3001');

export type ApiError = { message: string; statusCode: number };

let accessToken: string | null = null;

// Only stores/clears the access token. NEVER touches the refresh token.
export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('vs_access_token', token);
    } else {
      localStorage.removeItem('vs_access_token');
    }
  }
}

// Stores both tokens - only called on successful login/register/refresh
export function setTokens(newAccessToken: string, newRefreshToken: string) {
  accessToken = newAccessToken;
  if (typeof window !== 'undefined') {
    localStorage.setItem('vs_access_token', newAccessToken);
    localStorage.setItem('vs_refresh_token', newRefreshToken);
  }
}

// Clears all tokens - only called on explicit logout or real 401 (invalid refresh token)
export function clearAllTokens() {
  accessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('vs_access_token');
    localStorage.removeItem('vs_refresh_token');
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('vs_access_token');
  }
  return accessToken;
}

async function refreshAccessToken(): Promise<string | null> {
  const url = getApiUrl();
  const storedRefreshToken = typeof window !== 'undefined' ? localStorage.getItem('vs_refresh_token') : null;

  if (!storedRefreshToken) return null;

  try {
    const res = await fetch(`${url}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-refresh-token': storedRefreshToken,
      },
      body: JSON.stringify({ refreshToken: storedRefreshToken }),
      credentials: 'include',
    });

    if (res.status === 401) {
      // Refresh token is genuinely invalid/expired — clear everything, user must login
      clearAllTokens();
      return null;
    }

    if (!res.ok) {
      // Server error (500), deploy restart, network blip — DON'T clear tokens,
      // user's session is still valid, just temporarily unreachable
      console.warn('Token refresh temporarily failed (server/network issue), keeping tokens:', res.status);
      return null;
    }

    const data = (await res.json()) as { accessToken: string; refreshToken?: string };
    if (data.refreshToken) {
      setTokens(data.accessToken, data.refreshToken);
    } else {
      setAccessToken(data.accessToken);
    }
    return data.accessToken;
  } catch (err) {
    // Network error, server down — DON'T clear tokens, keep session alive
    console.warn('Token refresh network error, keeping tokens:', err);
    return null;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = getApiUrl();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res = await fetch(`${url}/api/v1${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && path !== '/auth/login') {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(`${url}/api/v1${path}`, {
        ...options,
        headers,
        credentials: 'include',
      });
    }
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(err.message) ? err.message[0] : err.message ?? res.statusText;
    throw { message, statusCode: res.status } as ApiError;
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

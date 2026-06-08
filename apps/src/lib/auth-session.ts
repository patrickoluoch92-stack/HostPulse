export type SessionUser = {
  id?: number;
  email?: string;
  name?: string;
};

export type StoredSession = {
  token: string;
  user: SessionUser | null;
};

const TOKEN_KEY = 'hostpulse_token';
const USER_KEY = 'hostpulse_user';

export function getStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    return null;
  }

  const rawUser = localStorage.getItem(USER_KEY);
  if (!rawUser) {
    return { token, user: null };
  }

  try {
    return { token, user: JSON.parse(rawUser) as SessionUser };
  } catch {
    localStorage.removeItem(USER_KEY);
    return { token, user: null };
  }
}

export function setStoredSession(session: StoredSession): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user ?? null));
}

export function clearStoredSession(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// localStorage-based auth — no backend required
// All data stays on the user's machine.

const AUTH_KEY = 'estimate_auth';

export interface LocalUser {
  email: string;
  displayName: string;
  state: string;
  createdAt: string;
}

function hashPassword(pw: string): string {
  // Simple deterministic hash for local-only storage (not security-critical)
  let h = 0;
  for (let i = 0; i < pw.length; i++) {
    h = Math.imul(31, h) + pw.charCodeAt(i) | 0;
  }
  return String(h >>> 0);
}

interface StoredAuth {
  user: LocalUser;
  passwordHash: string;
}

export function localSignUp(
  email: string,
  password: string,
  displayName: string,
  state: string
): LocalUser {
  const user: LocalUser = {
    email: email.toLowerCase().trim(),
    displayName,
    state,
    createdAt: new Date().toISOString(),
  };
  const stored: StoredAuth = { user, passwordHash: hashPassword(password) };
  localStorage.setItem(AUTH_KEY, JSON.stringify(stored));
  return user;
}

export function localSignIn(email: string, password: string): LocalUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const stored: StoredAuth = JSON.parse(raw);
    if (
      stored.user.email === email.toLowerCase().trim() &&
      stored.passwordHash === hashPassword(password)
    ) {
      return stored.user;
    }
    return null;
  } catch {
    return null;
  }
}

export function getLocalUser(): LocalUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as StoredAuth).user;
  } catch {
    return null;
  }
}

export function localSignOut(): void {
  localStorage.removeItem(AUTH_KEY);
}

export function isSignedIn(): boolean {
  return getLocalUser() !== null;
}

import { cookies } from 'next/headers';
import { createSession, getValidSession, deleteSession, type User } from '../db';

const SESSION_COOKIE_NAME = 'session_id';
const SESSION_EXPIRY_DAYS = 7;

export interface SessionUser {
  id: string;
  email: string;
}

/**
 * Create a new session and set the cookie
 */
export async function createUserSession(userId: string): Promise<string> {
  const session = await createSession(userId, SESSION_EXPIRY_DAYS);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60, // seconds
  });

  return session.id;
}

/**
 * Get the current session from cookies
 */
export async function getCurrentSession(): Promise<{ session: { id: string; expires_at: string }; user: SessionUser } | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    return null;
  }

  const result = await getValidSession(sessionId);

  if (!result) {
    // Session expired or invalid, clear the cookie
    await clearSessionCookie();
    return null;
  }

  return {
    session: {
      id: result.id,
      expires_at: result.expires_at,
    },
    user: {
      id: result.user.id,
      email: result.user.email,
    },
  };
}

/**
 * Get the current user from session
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const result = await getCurrentSession();
  return result?.user ?? null;
}

/**
 * Destroy the current session
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    await deleteSession(sessionId);
  }

  await clearSessionCookie();
}

/**
 * Clear the session cookie
 */
async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Validate session from request (for API routes that don't use cookies())
 */
export async function validateSessionId(sessionId: string): Promise<{ user: SessionUser } | null> {
  const result = await getValidSession(sessionId);

  if (!result) {
    return null;
  }

  return {
    user: {
      id: result.user.id,
      email: result.user.email,
    },
  };
}

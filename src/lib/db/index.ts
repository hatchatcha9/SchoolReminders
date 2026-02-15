import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';

// Get database connection
function getDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return neon(databaseUrl);
}

// Initialize schema
export async function initSchema(): Promise<void> {
  const sql = getDb();

  // Users table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Sessions table
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // User credentials table (encrypted)
  await sql`
    CREATE TABLE IF NOT EXISTS user_credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      service TEXT NOT NULL CHECK (service IN ('canvas', 'skyward')),
      encrypted_data TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (user_id, service)
    )
  `;

  // Create indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON user_credentials(user_id)`;
}

// User types
export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export interface UserCredential {
  id: string;
  user_id: string;
  service: 'canvas' | 'skyward';
  encrypted_data: string;
  iv: string;
  auth_tag: string;
  created_at: string;
  updated_at: string;
}

// User operations
export async function createUser(email: string, passwordHash: string): Promise<User> {
  const sql = getDb();
  const id = randomUUID();

  await sql`
    INSERT INTO users (id, email, password_hash)
    VALUES (${id}, ${email.toLowerCase()}, ${passwordHash})
  `;

  const user = await getUserById(id);
  if (!user) throw new Error('Failed to create user');
  return user;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;

  if (result.length === 0) return null;
  return result[0] as User;
}

export async function getUserById(id: string): Promise<User | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM users WHERE id = ${id}`;

  if (result.length === 0) return null;
  return result[0] as User;
}

// Session operations
export async function createSession(userId: string, expiresInDays: number = 7): Promise<Session> {
  const sql = getDb();
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  await sql`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (${id}, ${userId}, ${expiresAt})
  `;

  const session = await getSessionById(id);
  if (!session) throw new Error('Failed to create session');
  return session;
}

export async function getSessionById(id: string): Promise<Session | null> {
  const sql = getDb();
  const result = await sql`SELECT * FROM sessions WHERE id = ${id}`;

  if (result.length === 0) return null;
  return result[0] as Session;
}

export async function getValidSession(id: string): Promise<(Session & { user: User }) | null> {
  const sql = getDb();
  const result = await sql`
    SELECT s.*, u.id as uid, u.email, u.created_at as user_created_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ${id} AND s.expires_at > NOW()
  `;

  if (result.length === 0) return null;

  const row = result[0] as {
    id: string;
    user_id: string;
    expires_at: string;
    created_at: string;
    uid: string;
    email: string;
    user_created_at: string;
  };

  return {
    id: row.id,
    user_id: row.user_id,
    expires_at: row.expires_at,
    created_at: row.created_at,
    user: {
      id: row.uid,
      email: row.email,
      password_hash: '',
      created_at: row.user_created_at,
    },
  };
}

export async function deleteSession(id: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM sessions WHERE id = ${id}`;
}

export async function deleteUserSessions(userId: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM sessions WHERE user_id = ${userId}`;
}

export async function cleanExpiredSessions(): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM sessions WHERE expires_at <= NOW()`;
}

// Credential operations
export async function saveCredential(
  userId: string,
  service: 'canvas' | 'skyward',
  encryptedData: string,
  iv: string,
  authTag: string
): Promise<UserCredential> {
  const sql = getDb();
  const id = randomUUID();

  // Check if credential exists
  const existing = await getCredential(userId, service);

  if (existing) {
    // Update existing
    await sql`
      UPDATE user_credentials
      SET encrypted_data = ${encryptedData}, iv = ${iv}, auth_tag = ${authTag}, updated_at = NOW()
      WHERE user_id = ${userId} AND service = ${service}
    `;
  } else {
    // Insert new
    await sql`
      INSERT INTO user_credentials (id, user_id, service, encrypted_data, iv, auth_tag)
      VALUES (${id}, ${userId}, ${service}, ${encryptedData}, ${iv}, ${authTag})
    `;
  }

  const credential = await getCredential(userId, service);
  if (!credential) throw new Error('Failed to save credential');
  return credential;
}

export async function getCredential(userId: string, service: 'canvas' | 'skyward'): Promise<UserCredential | null> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM user_credentials WHERE user_id = ${userId} AND service = ${service}
  `;

  if (result.length === 0) return null;
  return result[0] as UserCredential;
}

export async function getUserCredentials(userId: string): Promise<UserCredential[]> {
  const sql = getDb();
  const result = await sql`SELECT * FROM user_credentials WHERE user_id = ${userId}`;
  return result as UserCredential[];
}

export async function deleteCredential(userId: string, service: 'canvas' | 'skyward'): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM user_credentials WHERE user_id = ${userId} AND service = ${service}`;
}

export { getDb };

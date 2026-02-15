import { createClient, Client } from '@libsql/client';
import { randomUUID } from 'crypto';

// Turso database client
let db: Client | null = null;

function getDb(): Client {
  if (!db) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error('TURSO_DATABASE_URL environment variable is required');
    }

    db = createClient({
      url,
      authToken,
    });
  }
  return db;
}

// Initialize schema
export async function initSchema(): Promise<void> {
  const database = getDb();

  // Users table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Sessions table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // User credentials table (encrypted)
  await database.execute(`
    CREATE TABLE IF NOT EXISTS user_credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      service TEXT NOT NULL CHECK (service IN ('canvas', 'skyward')),
      encrypted_data TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (user_id, service)
    )
  `);

  // Create indexes
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`);
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON user_credentials(user_id)`);
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
  const database = getDb();
  const id = randomUUID();

  await database.execute({
    sql: `INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`,
    args: [id, email.toLowerCase(), passwordHash],
  });

  const user = await getUserById(id);
  if (!user) throw new Error('Failed to create user');
  return user;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM users WHERE email = ?',
    args: [email.toLowerCase()],
  });

  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as User;
}

export async function getUserById(id: string): Promise<User | null> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM users WHERE id = ?',
    args: [id],
  });

  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as User;
}

// Session operations
export async function createSession(userId: string, expiresInDays: number = 7): Promise<Session> {
  const database = getDb();
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  await database.execute({
    sql: `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
    args: [id, userId, expiresAt],
  });

  const session = await getSessionById(id);
  if (!session) throw new Error('Failed to create session');
  return session;
}

export async function getSessionById(id: string): Promise<Session | null> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM sessions WHERE id = ?',
    args: [id],
  });

  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as Session;
}

export async function getValidSession(id: string): Promise<(Session & { user: User }) | null> {
  const database = getDb();
  const result = await database.execute({
    sql: `
      SELECT s.*, u.id as uid, u.email, u.created_at as user_created_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.expires_at > datetime('now')
    `,
    args: [id],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as unknown as {
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
  const database = getDb();
  await database.execute({
    sql: 'DELETE FROM sessions WHERE id = ?',
    args: [id],
  });
}

export async function deleteUserSessions(userId: string): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'DELETE FROM sessions WHERE user_id = ?',
    args: [userId],
  });
}

export async function cleanExpiredSessions(): Promise<void> {
  const database = getDb();
  await database.execute("DELETE FROM sessions WHERE expires_at <= datetime('now')");
}

// Credential operations
export async function saveCredential(
  userId: string,
  service: 'canvas' | 'skyward',
  encryptedData: string,
  iv: string,
  authTag: string
): Promise<UserCredential> {
  const database = getDb();
  const id = randomUUID();

  // Check if credential exists
  const existing = await getCredential(userId, service);

  if (existing) {
    // Update existing
    await database.execute({
      sql: `UPDATE user_credentials SET encrypted_data = ?, iv = ?, auth_tag = ?, updated_at = datetime('now') WHERE user_id = ? AND service = ?`,
      args: [encryptedData, iv, authTag, userId, service],
    });
  } else {
    // Insert new
    await database.execute({
      sql: `INSERT INTO user_credentials (id, user_id, service, encrypted_data, iv, auth_tag) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, userId, service, encryptedData, iv, authTag],
    });
  }

  const credential = await getCredential(userId, service);
  if (!credential) throw new Error('Failed to save credential');
  return credential;
}

export async function getCredential(userId: string, service: 'canvas' | 'skyward'): Promise<UserCredential | null> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM user_credentials WHERE user_id = ? AND service = ?',
    args: [userId, service],
  });

  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as UserCredential;
}

export async function getUserCredentials(userId: string): Promise<UserCredential[]> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM user_credentials WHERE user_id = ?',
    args: [userId],
  });

  return result.rows as unknown as UserCredential[];
}

export async function deleteCredential(userId: string, service: 'canvas' | 'skyward'): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'DELETE FROM user_credentials WHERE user_id = ? AND service = ?',
    args: [userId, service],
  });
}

export { getDb };

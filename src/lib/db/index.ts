import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';

// Database path - uses data/ directory in project root
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'school-reminder.db');

// Singleton database instance
let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema(): void {
  const database = db!;

  // Users table
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Sessions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // User credentials table (encrypted)
  database.exec(`
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
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON user_credentials(user_id);
  `);
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
export function createUser(email: string, passwordHash: string): User {
  const database = getDb();
  const id = randomUUID();

  const stmt = database.prepare(`
    INSERT INTO users (id, email, password_hash)
    VALUES (?, ?, ?)
  `);

  stmt.run(id, email.toLowerCase(), passwordHash);

  return getUserById(id)!;
}

export function getUserByEmail(email: string): User | null {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email.toLowerCase()) as User | null;
}

export function getUserById(id: string): User | null {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) as User | null;
}

// Session operations
export function createSession(userId: string, expiresInDays: number = 7): Session {
  const database = getDb();
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const stmt = database.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, ?)
  `);

  stmt.run(id, userId, expiresAt);

  return getSessionById(id)!;
}

export function getSessionById(id: string): Session | null {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM sessions WHERE id = ?');
  return stmt.get(id) as Session | null;
}

export function getValidSession(id: string): (Session & { user: User }) | null {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT s.*, u.id as user_id, u.email, u.created_at as user_created_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > datetime('now')
  `);

  const result = stmt.get(id) as {
    id: string;
    user_id: string;
    expires_at: string;
    created_at: string;
    email: string;
    user_created_at: string;
  } | undefined;

  if (!result) return null;

  return {
    id: result.id,
    user_id: result.user_id,
    expires_at: result.expires_at,
    created_at: result.created_at,
    user: {
      id: result.user_id,
      email: result.email,
      password_hash: '', // Don't expose password hash
      created_at: result.user_created_at,
    },
  };
}

export function deleteSession(id: string): void {
  const database = getDb();
  const stmt = database.prepare('DELETE FROM sessions WHERE id = ?');
  stmt.run(id);
}

export function deleteUserSessions(userId: string): void {
  const database = getDb();
  const stmt = database.prepare('DELETE FROM sessions WHERE user_id = ?');
  stmt.run(userId);
}

export function cleanExpiredSessions(): void {
  const database = getDb();
  const stmt = database.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')");
  stmt.run();
}

// Credential operations
export function saveCredential(
  userId: string,
  service: 'canvas' | 'skyward',
  encryptedData: string,
  iv: string,
  authTag: string
): UserCredential {
  const database = getDb();
  const id = randomUUID();

  // Use upsert to handle existing credentials
  const stmt = database.prepare(`
    INSERT INTO user_credentials (id, user_id, service, encrypted_data, iv, auth_tag)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id, service) DO UPDATE SET
      encrypted_data = excluded.encrypted_data,
      iv = excluded.iv,
      auth_tag = excluded.auth_tag,
      updated_at = datetime('now')
  `);

  stmt.run(id, userId, service, encryptedData, iv, authTag);

  return getCredential(userId, service)!;
}

export function getCredential(userId: string, service: 'canvas' | 'skyward'): UserCredential | null {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM user_credentials WHERE user_id = ? AND service = ?');
  return stmt.get(userId, service) as UserCredential | null;
}

export function getUserCredentials(userId: string): UserCredential[] {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM user_credentials WHERE user_id = ?');
  return stmt.all(userId) as UserCredential[];
}

export function deleteCredential(userId: string, service: 'canvas' | 'skyward'): void {
  const database = getDb();
  const stmt = database.prepare('DELETE FROM user_credentials WHERE user_id = ? AND service = ?');
  stmt.run(userId, service);
}

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    if (db) {
      db.close();
    }
  });
}

export { getDb };

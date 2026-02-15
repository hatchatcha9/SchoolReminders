/**
 * Local Storage Cache System
 * Provides caching for Canvas and Skyward data with expiration
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds (default: 5 minutes)
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export class DataCache {
  private prefix: string;

  constructor(prefix: string = 'school-reminder') {
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  /**
   * Store data in cache with optional TTL
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const ttl = options.ttl || DEFAULT_TTL;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    };

    try {
      localStorage.setItem(this.getKey(key), JSON.stringify(entry));
    } catch (error) {
      console.error('Cache set error:', error);
      // If localStorage is full, try to clear old entries
      this.clearExpired();
    }
  }

  /**
   * Get data from cache if not expired
   */
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(this.getKey(key));
      if (!raw) return null;

      const entry: CacheEntry<T> = JSON.parse(raw);

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        this.delete(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Get data with metadata (timestamp, expiration)
   */
  getWithMeta<T>(key: string): CacheEntry<T> | null {
    try {
      const raw = localStorage.getItem(this.getKey(key));
      if (!raw) return null;

      const entry: CacheEntry<T> = JSON.parse(raw);

      if (Date.now() > entry.expiresAt) {
        this.delete(key);
        return null;
      }

      return entry;
    } catch (error) {
      console.error('Cache getWithMeta error:', error);
      return null;
    }
  }

  /**
   * Check if cache entry exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete a cache entry
   */
  delete(key: string): void {
    localStorage.removeItem(this.getKey(key));
  }

  /**
   * Clear all cache entries for this prefix
   */
  clear(): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix + ':')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix + ':')) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const entry = JSON.parse(raw);
            if (Date.now() > entry.expiresAt) {
              keysToRemove.push(key);
            }
          }
        } catch {
          // Invalid entry, remove it
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Get cache age in milliseconds
   */
  getAge(key: string): number | null {
    const entry = this.getWithMeta(key);
    if (!entry) return null;
    return Date.now() - entry.timestamp;
  }

  /**
   * Check if cache is stale (older than given ms)
   */
  isStale(key: string, maxAge: number): boolean {
    const age = this.getAge(key);
    if (age === null) return true;
    return age > maxAge;
  }
}

// Cache keys
export const CACHE_KEYS = {
  CANVAS_COURSES: 'canvas:courses',
  CANVAS_ASSIGNMENTS: 'canvas:assignments',
  CANVAS_GRADES: 'canvas:grades',
  SKYWARD_COURSES: 'skyward:courses',
  SKYWARD_GRADES: 'skyward:grades',
  UNIFIED_ASSIGNMENTS: 'unified:assignments',
  LAST_SYNC: 'sync:lastSync',
  SYNC_STATUS: 'sync:status',
};

// TTL presets
export const CACHE_TTL = {
  SHORT: 2 * 60 * 1000,      // 2 minutes
  MEDIUM: 5 * 60 * 1000,     // 5 minutes
  LONG: 15 * 60 * 1000,      // 15 minutes
  VERY_LONG: 60 * 60 * 1000, // 1 hour
};

// Singleton instance
export const dataCache = new DataCache('school-reminder');

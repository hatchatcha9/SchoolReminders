/**
 * Data Sync Service
 * Handles periodic synchronization of Canvas and Skyward data
 */

import { dataCache, CACHE_KEYS, CACHE_TTL } from '../cache';

export interface SyncStatus {
  lastSync: number | null;
  inProgress: boolean;
  error: string | null;
  sources: {
    canvas: { synced: boolean; lastSync: number | null; error: string | null };
    skyward: { synced: boolean; lastSync: number | null; error: string | null };
  };
}

export interface UnifiedAssignment {
  id: string;
  title: string;
  description: string | null;
  course: string;
  courseId: string;
  dueDate: Date | null;
  lockDate: Date | null;
  source: 'canvas' | 'skyward';
  pointsPossible: number | null;
  score: number | null;
  grade: string | null;
  submitted: boolean;
  late: boolean;
  missing: boolean;
  type: 'assignment' | 'quiz' | 'test' | 'discussion';
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface UnifiedCourse {
  id: string;
  name: string;
  code: string;
  source: 'canvas' | 'skyward' | 'both';
  canvasId?: number;
  currentScore: number | null;
  currentGrade: string | null;
  teacher?: string;
  period?: string;
}

// Interfaces for cached data
interface CachedCanvasAssignment {
  id: number;
  name: string;
  description?: string;
  courseName?: string;
  course_id: number;
  due_at?: string;
  lock_at?: string;
  points_possible?: number;
  submission?: {
    score?: number;
    grade?: string;
    submitted?: boolean;
    late?: boolean;
    missing?: boolean;
  };
}

interface CachedCanvasCourse {
  id: number;
  name: string;
  code: string;
  currentScore?: number;
  currentGrade?: string;
}

interface CachedSkywardData {
  courses?: Array<{
    name: string;
    teacher?: string;
    period?: string;
    grades?: Array<{
      letter?: string;
      isCurrent?: boolean;
    }>;
  }>;
}

// Detect assignment type from name
function detectAssignmentType(name: string): 'assignment' | 'quiz' | 'test' | 'discussion' {
  const lower = name.toLowerCase();
  if (lower.includes('test') || lower.includes('exam') || lower.includes('final')) return 'test';
  if (lower.includes('quiz')) return 'quiz';
  if (lower.includes('discussion') || lower.includes('forum')) return 'discussion';
  return 'assignment';
}

// Calculate priority based on due date
function calculatePriority(dueDate: Date | null): 'low' | 'medium' | 'high' | 'urgent' {
  if (!dueDate) return 'low';

  const now = new Date();
  const diff = dueDate.getTime() - now.getTime();
  const hours = diff / (1000 * 60 * 60);

  if (hours < 0) return 'urgent'; // Overdue
  if (hours < 24) return 'urgent';
  if (hours < 48) return 'high';
  if (hours < 72) return 'medium';
  return 'low';
}

class SyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private status: SyncStatus = {
    lastSync: null,
    inProgress: false,
    error: null,
    sources: {
      canvas: { synced: false, lastSync: null, error: null },
      skyward: { synced: false, lastSync: null, error: null },
    },
  };

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    // Try to restore status from cache
    const cached = dataCache.get<SyncStatus>(CACHE_KEYS.SYNC_STATUS);
    if (cached) {
      this.status = { ...cached, inProgress: false };
    }
    return this.status;
  }

  /**
   * Save sync status to cache
   */
  private saveStatus(): void {
    dataCache.set(CACHE_KEYS.SYNC_STATUS, this.status, { ttl: CACHE_TTL.VERY_LONG });
  }

  /**
   * Sync Canvas data
   */
  async syncCanvas(token: string): Promise<boolean> {
    try {
      this.status.sources.canvas.error = null;

      // Fetch courses with grades
      const coursesResponse = await fetch('/api/canvas/courses', {
        headers: { 'x-canvas-token': token },
      });

      if (!coursesResponse.ok) {
        throw new Error(`Failed to fetch courses: ${coursesResponse.status}`);
      }

      const coursesData = await coursesResponse.json();
      dataCache.set(CACHE_KEYS.CANVAS_COURSES, coursesData.courses, { ttl: CACHE_TTL.MEDIUM });

      // Fetch assignments
      const assignmentsResponse = await fetch('/api/canvas/assignments?days=30', {
        headers: { 'x-canvas-token': token },
      });

      if (!assignmentsResponse.ok) {
        throw new Error(`Failed to fetch assignments: ${assignmentsResponse.status}`);
      }

      const assignmentsData = await assignmentsResponse.json();
      dataCache.set(CACHE_KEYS.CANVAS_ASSIGNMENTS, assignmentsData.assignments, { ttl: CACHE_TTL.MEDIUM });

      this.status.sources.canvas.synced = true;
      this.status.sources.canvas.lastSync = Date.now();
      this.saveStatus();

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.status.sources.canvas.error = message;
      this.saveStatus();
      console.error('Canvas sync error:', error);
      return false;
    }
  }

  /**
   * Sync Skyward data (when available)
   */
  async syncSkyward(): Promise<boolean> {
    try {
      this.status.sources.skyward.error = null;

      const username = localStorage.getItem('skywardUsername');
      const password = localStorage.getItem('skywardPassword');

      if (!username || !password) {
        this.status.sources.skyward.error = 'Not connected';
        return false;
      }

      const response = await fetch('/api/skyward/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: atob(password) }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch Skyward data');
      }

      const data = await response.json();
      dataCache.set(CACHE_KEYS.SKYWARD_GRADES, data, { ttl: CACHE_TTL.LONG });

      this.status.sources.skyward.synced = true;
      this.status.sources.skyward.lastSync = Date.now();
      this.saveStatus();

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.status.sources.skyward.error = message;
      this.saveStatus();
      console.error('Skyward sync error:', error);
      return false;
    }
  }

  /**
   * Full sync - Canvas and Skyward
   */
  async syncAll(): Promise<SyncStatus> {
    if (this.status.inProgress) {
      return this.status;
    }

    this.status.inProgress = true;
    this.status.error = null;

    const token = localStorage.getItem('canvasToken');
    const skywardConnected = localStorage.getItem('skywardConnected') === 'true';

    await Promise.allSettled([
      token ? this.syncCanvas(token) : Promise.resolve(false),
      skywardConnected ? this.syncSkyward() : Promise.resolve(false),
    ]);

    // Build unified assignments after sync
    this.buildUnifiedAssignments();

    this.status.inProgress = false;
    this.status.lastSync = Date.now();
    dataCache.set(CACHE_KEYS.LAST_SYNC, Date.now(), { ttl: CACHE_TTL.VERY_LONG });
    this.saveStatus();

    return this.status;
  }

  /**
   * Build unified assignments from all sources
   */
  buildUnifiedAssignments(): UnifiedAssignment[] {
    const unified: UnifiedAssignment[] = [];

    // Get Canvas assignments
    const canvasAssignments = dataCache.get<CachedCanvasAssignment[]>(CACHE_KEYS.CANVAS_ASSIGNMENTS) || [];

    canvasAssignments.forEach((a) => {
      const dueDate = a.due_at ? new Date(a.due_at) : null;

      unified.push({
        id: `canvas-${a.id}`,
        title: a.name,
        description: a.description || null,
        course: a.courseName || 'Unknown Course',
        courseId: `canvas-${a.course_id}`,
        dueDate,
        lockDate: a.lock_at ? new Date(a.lock_at) : null,
        source: 'canvas',
        pointsPossible: a.points_possible || null,
        score: a.submission?.score || null,
        grade: a.submission?.grade || null,
        submitted: a.submission?.submitted || false,
        late: a.submission?.late || false,
        missing: a.submission?.missing || false,
        type: detectAssignmentType(a.name),
        priority: calculatePriority(dueDate),
      });
    });

    // Sort by due date
    unified.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

    // Cache unified assignments
    dataCache.set(CACHE_KEYS.UNIFIED_ASSIGNMENTS, unified, { ttl: CACHE_TTL.MEDIUM });

    return unified;
  }

  /**
   * Get unified assignments (from cache or build)
   */
  getUnifiedAssignments(): UnifiedAssignment[] {
    const cached = dataCache.get<UnifiedAssignment[]>(CACHE_KEYS.UNIFIED_ASSIGNMENTS);
    if (cached) {
      // Restore Date objects
      return cached.map(a => ({
        ...a,
        dueDate: a.dueDate ? new Date(a.dueDate) : null,
        lockDate: a.lockDate ? new Date(a.lockDate) : null,
      }));
    }
    return this.buildUnifiedAssignments();
  }

  /**
   * Get unified courses
   */
  getUnifiedCourses(): UnifiedCourse[] {
    const unified: UnifiedCourse[] = [];

    // Get Canvas courses
    const canvasCourses = dataCache.get<CachedCanvasCourse[]>(CACHE_KEYS.CANVAS_COURSES) || [];

    canvasCourses.forEach((c) => {
      unified.push({
        id: `canvas-${c.id}`,
        name: c.name,
        code: c.code,
        source: 'canvas',
        canvasId: c.id,
        currentScore: c.currentScore ?? null,
        currentGrade: c.currentGrade ?? null,
      });
    });

    // Get Skyward courses (if available)
    const skywardData = dataCache.get<CachedSkywardData>(CACHE_KEYS.SKYWARD_GRADES);
    if (skywardData?.courses) {
      skywardData.courses.forEach((c) => {
        // Check if this course matches a Canvas course
        const existingIndex = unified.findIndex(
          (u) => u.name.toLowerCase().includes(c.name.toLowerCase().split(' ')[0])
        );

        if (existingIndex >= 0) {
          unified[existingIndex].source = 'both';
          unified[existingIndex].teacher = c.teacher;
          unified[existingIndex].period = c.period;
        } else {
          unified.push({
            id: `skyward-${c.name}`,
            name: c.name,
            code: c.period || '',
            source: 'skyward',
            currentScore: null,
            currentGrade: c.grades?.find((g) => g.isCurrent)?.letter || null,
            teacher: c.teacher,
            period: c.period,
          });
        }
      });
    }

    return unified;
  }

  /**
   * Start automatic sync interval
   */
  startAutoSync(intervalMs: number = 5 * 60 * 1000): void {
    this.stopAutoSync();
    this.syncInterval = setInterval(() => {
      this.syncAll();
    }, intervalMs);

    // Do initial sync
    this.syncAll();
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Check if sync is needed (data is stale)
   */
  needsSync(maxAge: number = CACHE_TTL.MEDIUM): boolean {
    const lastSync = dataCache.get<number>(CACHE_KEYS.LAST_SYNC);
    if (!lastSync) return true;
    return Date.now() - lastSync > maxAge;
  }

  /**
   * Get time since last sync in human readable format
   */
  getTimeSinceLastSync(): string {
    const lastSync = dataCache.get<number>(CACHE_KEYS.LAST_SYNC);
    if (!lastSync) return 'Never';

    const diff = Date.now() - lastSync;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }
}

// Singleton instance
export const syncService = new SyncService();

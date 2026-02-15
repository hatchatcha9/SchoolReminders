'use client';

import { useState, useEffect, useCallback } from 'react';
import { syncService, SyncStatus, UnifiedAssignment, UnifiedCourse } from '@/lib/sync';
import { dataCache } from '@/lib/cache';

interface UseSyncResult {
  // Status
  status: SyncStatus;
  isLoading: boolean;
  lastSyncTime: string;
  needsSync: boolean;

  // Data
  assignments: UnifiedAssignment[];
  courses: UnifiedCourse[];

  // Actions
  sync: () => Promise<void>;
  clearCache: () => void;
}

export function useSync(autoSync: boolean = true): UseSyncResult {
  const [status, setStatus] = useState<SyncStatus>(syncService.getStatus());
  const [isLoading, setIsLoading] = useState(false);
  const [assignments, setAssignments] = useState<UnifiedAssignment[]>([]);
  const [courses, setCourses] = useState<UnifiedCourse[]>([]);

  // Sync function
  const sync = useCallback(async () => {
    setIsLoading(true);
    try {
      const newStatus = await syncService.syncAll();
      setStatus(newStatus);
      setAssignments(syncService.getUnifiedAssignments());
      setCourses(syncService.getUnifiedCourses());
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load initial data from cache
  useEffect(() => {
    const cached = syncService.getUnifiedAssignments();
    setAssignments(cached);
    setCourses(syncService.getUnifiedCourses());

    // Auto-sync if needed
    if (autoSync && syncService.needsSync()) {
      sync();
    }
  }, [autoSync, sync]);

  // Clear cache
  const clearCache = useCallback(() => {
    dataCache.clear();
    setAssignments([]);
    setCourses([]);
    setStatus(syncService.getStatus());
  }, []);

  return {
    status,
    isLoading,
    lastSyncTime: syncService.getTimeSinceLastSync(),
    needsSync: syncService.needsSync(),
    assignments,
    courses,
    sync,
    clearCache,
  };
}

/**
 * Hook for just getting cached data without syncing
 */
export function useCachedData() {
  const [assignments] = useState<UnifiedAssignment[]>(() => syncService.getUnifiedAssignments());
  const [courses] = useState<UnifiedCourse[]>(() => syncService.getUnifiedCourses());

  return { assignments, courses };
}

/**
 * Hook for getting sync status only
 */
export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>(syncService.getStatus());

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(syncService.getStatus());
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    status,
    lastSyncTime: syncService.getTimeSinceLastSync(),
    needsSync: syncService.needsSync(),
  };
}

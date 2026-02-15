'use client';

import { useState, useEffect } from 'react';

interface Assignment {
  id: string;
  title: string;
  course: string;
  dueDate: Date;
  lockDate?: Date;
}

interface LockingAlertsProps {
  assignments: Assignment[];
  onViewAssignment?: (assignment: Assignment) => void;
}

function formatTimeRemaining(date: Date): string {
  const now = Date.now();
  const time = new Date(date).getTime();
  const diff = time - now;

  if (diff < 0) return 'Locked';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 1) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export default function LockingAlerts({ assignments, onViewAssignment }: LockingAlertsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Filter to assignments with lock dates that are locking within 6 hours
  const sixHours = 6 * 60 * 60 * 1000;
  const lockingAssignments = assignments.filter(a => {
    if (!a.lockDate || dismissed.has(a.id)) return false;
    const lockTime = new Date(a.lockDate).getTime();
    return lockTime > currentTime && lockTime - currentTime <= sixHours;
  });

  if (lockingAssignments.length === 0) return null;

  return (
    <div className="space-y-2">
      {lockingAssignments.map(assignment => (
        <div
          key={assignment.id}
          className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-3"
        >
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600 dark:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-red-800 dark:text-red-200 truncate">
              {assignment.title}
            </p>
            <p className="text-sm text-red-600 dark:text-red-300">
              {assignment.course} - Locks in <span className="font-bold">{formatTimeRemaining(assignment.lockDate!)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onViewAssignment && (
              <button
                onClick={() => onViewAssignment(assignment)}
                className="px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                View
              </button>
            )}
            <button
              onClick={() => setDismissed(prev => new Set([...prev, assignment.id]))}
              className="p-1.5 text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
              title="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

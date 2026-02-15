'use client';

import { useEffect, useCallback, useState } from 'react';
import {
  startReminderScheduler,
  getAssignmentsLockingSoon,
  getUrgentAssignments,
  sendImmediateReminder,
} from '@/lib/reminders/scheduler';

interface Assignment {
  id: string;
  title: string;
  course: string;
  dueDate: Date;
  lockDate?: Date;
  type?: 'test' | 'quiz' | 'assignment';
  priority?: 'high' | 'medium' | 'low';
}

interface UseRemindersResult {
  lockingSoon: Assignment[];
  urgent: Assignment[];
  sendReminder: (assignment: Assignment) => boolean;
}

/**
 * Hook to manage reminders for assignments
 */
export function useReminders(assignments: Assignment[]): UseRemindersResult {
  const [lockingSoon, setLockingSoon] = useState<Assignment[]>([]);
  const [urgent, setUrgent] = useState<Assignment[]>([]);

  // Start the reminder scheduler
  useEffect(() => {
    const getAssignments = () => assignments;
    const cleanup = startReminderScheduler(getAssignments);

    return cleanup;
  }, [assignments]);

  // Update locking soon and urgent assignments
  useEffect(() => {
    const updateAlerts = () => {
      setLockingSoon(getAssignmentsLockingSoon(assignments, 6));
      setUrgent(getUrgentAssignments(assignments, 24));
    };

    updateAlerts();

    // Update every minute
    const interval = setInterval(updateAlerts, 60 * 1000);
    return () => clearInterval(interval);
  }, [assignments]);

  const sendReminder = useCallback((assignment: Assignment) => {
    return sendImmediateReminder(assignment);
  }, []);

  return {
    lockingSoon,
    urgent,
    sendReminder,
  };
}

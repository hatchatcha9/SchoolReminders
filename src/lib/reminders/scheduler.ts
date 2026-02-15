'use client';

import { sendNotification, getNotificationPrefs } from '../notifications';

/**
 * Reminder Scheduler for School Reminder
 *
 * Handles scheduling and sending reminders for:
 * - Assignments due soon
 * - Assignments locking soon
 * - Custom reminder times
 */

interface Assignment {
  id: string;
  title: string;
  course: string;
  dueDate: Date;
  lockDate?: Date;
  type?: 'test' | 'quiz' | 'assignment';
  priority?: 'high' | 'medium' | 'low';
}

interface ReminderSettings {
  enabled: boolean;
  remind24h: boolean;
  remind6h: boolean;
  remind1h: boolean;
  remindLocking: boolean;
  remindTests: boolean;
}

const REMINDER_SETTINGS_KEY = 'school-reminder:reminder-settings';
const SENT_REMINDERS_KEY = 'school-reminder:sent-reminders';

/**
 * Get reminder settings
 */
export function getReminderSettings(): ReminderSettings {
  if (typeof window === 'undefined') {
    return {
      enabled: true,
      remind24h: true,
      remind6h: true,
      remind1h: true,
      remindLocking: true,
      remindTests: true,
    };
  }

  try {
    const stored = localStorage.getItem(REMINDER_SETTINGS_KEY);
    if (stored) {
      const settings = JSON.parse(stored);
      // Convert old format if needed
      if (Array.isArray(settings)) {
        return {
          enabled: true,
          remind24h: settings.some(s => s.id === 'due-24h' && s.enabled),
          remind6h: settings.some(s => s.id === 'due-6h' && s.enabled),
          remind1h: settings.some(s => s.id === 'due-1h' && s.enabled),
          remindLocking: settings.some(s => s.id === 'lock-warning' && s.enabled),
          remindTests: settings.some(s => s.id === 'test-reminder' && s.enabled),
        };
      }
      return settings;
    }
  } catch {
    // Ignore
  }

  return {
    enabled: true,
    remind24h: true,
    remind6h: true,
    remind1h: true,
    remindLocking: true,
    remindTests: true,
  };
}

/**
 * Get list of already-sent reminders
 */
function getSentReminders(): Set<string> {
  if (typeof window === 'undefined') return new Set();

  try {
    const stored = localStorage.getItem(SENT_REMINDERS_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      // Clean up old entries (older than 7 days)
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const filtered = Object.entries(data)
        .filter(([, timestamp]) => (timestamp as number) > weekAgo)
        .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {});
      localStorage.setItem(SENT_REMINDERS_KEY, JSON.stringify(filtered));
      return new Set(Object.keys(filtered));
    }
  } catch {
    // Ignore
  }

  return new Set();
}

/**
 * Mark a reminder as sent
 */
function markReminderSent(reminderId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const stored = localStorage.getItem(SENT_REMINDERS_KEY);
    const data = stored ? JSON.parse(stored) : {};
    data[reminderId] = Date.now();
    localStorage.setItem(SENT_REMINDERS_KEY, JSON.stringify(data));
  } catch {
    // Ignore
  }
}

/**
 * Format time remaining as human-readable string
 */
function formatTimeRemaining(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
  }
  if (hours >= 1) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  if (minutes >= 1) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  return 'less than a minute';
}

/**
 * Check and send reminders for assignments
 */
export function checkAndSendReminders(assignments: Assignment[]): void {
  const prefs = getNotificationPrefs();
  if (!prefs.enabled) return;

  const settings = getReminderSettings();
  if (!settings.enabled) return;

  const sentReminders = getSentReminders();
  const now = Date.now();

  for (const assignment of assignments) {
    const dueTime = new Date(assignment.dueDate).getTime();
    const timeUntilDue = dueTime - now;

    // Skip if already past due
    if (timeUntilDue < 0) continue;

    const isTest = assignment.type === 'test' || assignment.type === 'quiz' ||
      assignment.title.toLowerCase().includes('test') ||
      assignment.title.toLowerCase().includes('quiz') ||
      assignment.title.toLowerCase().includes('exam');

    // Check for test reminders (extra reminder for tests)
    if (settings.remindTests && isTest) {
      const testReminderId = `test-${assignment.id}`;
      const hours48 = 48 * 60 * 60 * 1000;
      const hours47 = 47 * 60 * 60 * 1000;

      if (timeUntilDue <= hours48 && timeUntilDue > hours47 && !sentReminders.has(testReminderId)) {
        sendNotification(`Upcoming ${assignment.type || 'Test'}: ${assignment.title}`, {
          body: `${assignment.course} - in 2 days. Start studying!`,
          tag: testReminderId,
          requireInteraction: true,
        });
        markReminderSent(testReminderId);
      }
    }

    // 24 hour reminder
    if (settings.remind24h) {
      const reminderId = `24h-${assignment.id}`;
      const hours24 = 24 * 60 * 60 * 1000;
      const hours23 = 23 * 60 * 60 * 1000;

      if (timeUntilDue <= hours24 && timeUntilDue > hours23 && !sentReminders.has(reminderId)) {
        sendNotification(`Due Tomorrow: ${assignment.title}`, {
          body: `${assignment.course} - due in ${formatTimeRemaining(timeUntilDue)}`,
          tag: reminderId,
        });
        markReminderSent(reminderId);
      }
    }

    // 6 hour reminder
    if (settings.remind6h) {
      const reminderId = `6h-${assignment.id}`;
      const hours6 = 6 * 60 * 60 * 1000;
      const hours5 = 5 * 60 * 60 * 1000;

      if (timeUntilDue <= hours6 && timeUntilDue > hours5 && !sentReminders.has(reminderId)) {
        sendNotification(`Due Soon: ${assignment.title}`, {
          body: `${assignment.course} - due in ${formatTimeRemaining(timeUntilDue)}`,
          tag: reminderId,
          requireInteraction: true,
        });
        markReminderSent(reminderId);
      }
    }

    // 1 hour reminder
    if (settings.remind1h) {
      const reminderId = `1h-${assignment.id}`;
      const hours1 = 60 * 60 * 1000;
      const mins45 = 45 * 60 * 1000;

      if (timeUntilDue <= hours1 && timeUntilDue > mins45 && !sentReminders.has(reminderId)) {
        sendNotification(`Due Very Soon: ${assignment.title}`, {
          body: `${assignment.course} - due in ${formatTimeRemaining(timeUntilDue)}!`,
          tag: reminderId,
          requireInteraction: true,
        });
        markReminderSent(reminderId);
      }
    }

    // Locking soon reminder
    if (settings.remindLocking && assignment.lockDate) {
      const lockTime = new Date(assignment.lockDate).getTime();
      const timeUntilLock = lockTime - now;

      if (timeUntilLock > 0) {
        const lockReminderId = `lock-${assignment.id}`;
        const hours2 = 2 * 60 * 60 * 1000;
        const hours1 = 1 * 60 * 60 * 1000;

        if (timeUntilLock <= hours2 && timeUntilLock > hours1 && !sentReminders.has(lockReminderId)) {
          sendNotification(`Locking Soon: ${assignment.title}`, {
            body: `${assignment.course} - locks in ${formatTimeRemaining(timeUntilLock)}! Submit now.`,
            tag: lockReminderId,
            requireInteraction: true,
          });
          markReminderSent(lockReminderId);
        }
      }
    }
  }
}

/**
 * Start the reminder scheduler
 * Returns a cleanup function to stop the scheduler
 */
export function startReminderScheduler(
  getAssignments: () => Assignment[]
): () => void {
  // Check immediately
  checkAndSendReminders(getAssignments());

  // Check every 5 minutes
  const interval = setInterval(() => {
    checkAndSendReminders(getAssignments());
  }, 5 * 60 * 1000);

  // Return cleanup function
  return () => clearInterval(interval);
}

/**
 * Send an immediate reminder for a specific assignment
 */
export function sendImmediateReminder(assignment: Assignment): boolean {
  const prefs = getNotificationPrefs();
  if (!prefs.enabled) return false;

  const dueTime = new Date(assignment.dueDate).getTime();
  const timeUntilDue = dueTime - Date.now();

  if (timeUntilDue < 0) {
    sendNotification(`Overdue: ${assignment.title}`, {
      body: `${assignment.course} - this assignment is past due!`,
      tag: `immediate-${assignment.id}`,
      requireInteraction: true,
    });
  } else {
    sendNotification(`Reminder: ${assignment.title}`, {
      body: `${assignment.course} - due in ${formatTimeRemaining(timeUntilDue)}`,
      tag: `immediate-${assignment.id}`,
    });
  }

  return true;
}

/**
 * Check for assignments locking soon and return them
 */
export function getAssignmentsLockingSoon(
  assignments: Assignment[],
  withinHours: number = 6
): Assignment[] {
  const now = Date.now();
  const threshold = withinHours * 60 * 60 * 1000;

  return assignments.filter(a => {
    if (!a.lockDate) return false;
    const lockTime = new Date(a.lockDate).getTime();
    const timeUntilLock = lockTime - now;
    return timeUntilLock > 0 && timeUntilLock <= threshold;
  });
}

/**
 * Check for urgent assignments (due within hours)
 */
export function getUrgentAssignments(
  assignments: Assignment[],
  withinHours: number = 24
): Assignment[] {
  const now = Date.now();
  const threshold = withinHours * 60 * 60 * 1000;

  return assignments.filter(a => {
    const dueTime = new Date(a.dueDate).getTime();
    const timeUntilDue = dueTime - now;
    return timeUntilDue > 0 && timeUntilDue <= threshold;
  });
}

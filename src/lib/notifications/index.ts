/**
 * Browser Notifications for School Reminder
 *
 * Handles requesting permission, sending notifications,
 * and storing preferences in localStorage.
 */

const NOTIFICATION_PREFS_KEY = 'notificationPrefs';

interface NotificationPrefs {
  enabled: boolean;
  urgentOnly: boolean;
  lastPrompt: number | null;
}

/**
 * Get notification preferences from localStorage
 */
export function getNotificationPrefs(): NotificationPrefs {
  if (typeof window === 'undefined') {
    return { enabled: false, urgentOnly: false, lastPrompt: null };
  }

  try {
    const stored = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading notification prefs:', e);
  }

  return { enabled: false, urgentOnly: false, lastPrompt: null };
}

/**
 * Save notification preferences to localStorage
 */
export function saveNotificationPrefs(prefs: Partial<NotificationPrefs>): void {
  if (typeof window === 'undefined') return;

  try {
    const current = getNotificationPrefs();
    const updated = { ...current, ...prefs };
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving notification prefs:', e);
  }
}

/**
 * Check if browser supports notifications
 */
export function supportsNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Get current notification permission status
 */
export function getPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!supportsNotifications()) return 'unsupported';
  return Notification.permission;
}

/**
 * Request notification permission from the user
 */
export async function requestPermission(): Promise<boolean> {
  if (!supportsNotifications()) return false;

  try {
    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';

    saveNotificationPrefs({
      enabled: granted,
      lastPrompt: Date.now(),
    });

    return granted;
  } catch (e) {
    console.error('Error requesting notification permission:', e);
    return false;
  }
}

/**
 * Send a browser notification
 */
export function sendNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
    requireInteraction?: boolean;
    data?: Record<string, unknown>;
  }
): Notification | null {
  if (!supportsNotifications()) return null;
  if (Notification.permission !== 'granted') return null;

  const prefs = getNotificationPrefs();
  if (!prefs.enabled) return null;

  try {
    const notification = new Notification(title, {
      body: options?.body,
      icon: options?.icon || '/favicon.ico',
      tag: options?.tag,
      requireInteraction: options?.requireInteraction || false,
      data: options?.data,
    });

    // Auto-close after 5 seconds unless requireInteraction is true
    if (!options?.requireInteraction) {
      setTimeout(() => notification.close(), 5000);
    }

    return notification;
  } catch (e) {
    console.error('Error sending notification:', e);
    return null;
  }
}

/**
 * Send an urgent assignment notification
 */
export function notifyUrgentAssignment(
  assignmentTitle: string,
  courseName: string,
  dueIn: string
): Notification | null {
  return sendNotification(`Urgent: ${assignmentTitle}`, {
    body: `${courseName} - Due ${dueIn}`,
    tag: `urgent-${assignmentTitle}`,
    requireInteraction: true,
  });
}

/**
 * Send a reminder notification
 */
export function notifyReminder(
  message: string,
  assignmentTitle?: string
): Notification | null {
  return sendNotification(assignmentTitle || 'School Reminder', {
    body: message,
    tag: `reminder-${Date.now()}`,
  });
}

/**
 * Check if we should prompt the user to enable notifications
 * (Only prompt once per day at most)
 */
export function shouldPromptForNotifications(): boolean {
  if (!supportsNotifications()) return false;
  if (Notification.permission !== 'default') return false;

  const prefs = getNotificationPrefs();
  if (prefs.lastPrompt) {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    if (prefs.lastPrompt > oneDayAgo) return false;
  }

  return true;
}

/**
 * Schedule notifications for urgent assignments
 * (To be called on dashboard load)
 */
export function scheduleUrgentNotifications(
  assignments: Array<{
    id: string;
    title: string;
    course: string;
    dueDate: Date;
    priority: 'high' | 'medium' | 'low';
  }>
): void {
  const prefs = getNotificationPrefs();
  if (!prefs.enabled) return;

  // Filter to urgent assignments (due within 24 hours)
  const now = Date.now();
  const oneDayFromNow = now + 24 * 60 * 60 * 1000;

  const urgentAssignments = assignments.filter(a => {
    const dueTime = new Date(a.dueDate).getTime();
    return dueTime > now && dueTime <= oneDayFromNow;
  });

  // Check for already-notified assignments
  const notifiedKey = 'notifiedAssignments';
  let notified: string[] = [];
  try {
    notified = JSON.parse(localStorage.getItem(notifiedKey) || '[]');
  } catch {
    notified = [];
  }

  // Send notifications for new urgent assignments
  for (const assignment of urgentAssignments) {
    if (notified.includes(assignment.id)) continue;

    const hoursUntilDue = Math.floor(
      (new Date(assignment.dueDate).getTime() - now) / (1000 * 60 * 60)
    );

    let dueIn = 'soon';
    if (hoursUntilDue <= 1) dueIn = 'in less than an hour';
    else if (hoursUntilDue <= 2) dueIn = 'in about 2 hours';
    else if (hoursUntilDue <= 6) dueIn = `in ${hoursUntilDue} hours`;
    else if (hoursUntilDue <= 12) dueIn = 'later today';
    else dueIn = 'tomorrow';

    notifyUrgentAssignment(assignment.title, assignment.course, dueIn);
    notified.push(assignment.id);
  }

  // Save updated notified list (keep last 50)
  try {
    localStorage.setItem(notifiedKey, JSON.stringify(notified.slice(-50)));
  } catch {
    // Ignore storage errors
  }
}

'use client';

import { useState, useCallback } from 'react';
import {
  getPermissionStatus,
  requestPermission,
} from '@/lib/notifications';

interface Notification {
  id: string;
  type: 'urgent' | 'reminder' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  assignmentId?: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  assignments?: Array<{
    id: string;
    title: string;
    course: string;
    dueDate: Date;
    priority: 'high' | 'medium' | 'low';
  }>;
}

const NOTIFICATIONS_STORAGE_KEY = 'school-reminder:notifications';

function getStoredNotifications(): Notification[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (stored) {
      const notifications = JSON.parse(stored);
      return notifications.map((n: Notification) => ({
        ...n,
        timestamp: new Date(n.timestamp),
      }));
    }
  } catch {
    // Ignore errors
  }
  return [];
}

function saveNotifications(notifications: Notification[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications.slice(-50)));
  } catch {
    // Ignore errors
  }
}

function getTypeStyles(type: Notification['type']): { bg: string; icon: string; border: string } {
  switch (type) {
    case 'urgent':
      return { bg: 'bg-red-50', icon: '🚨', border: 'border-red-200' };
    case 'reminder':
      return { bg: 'bg-amber-50', icon: '⏰', border: 'border-amber-200' };
    case 'success':
      return { bg: 'bg-green-50', icon: '✓', border: 'border-green-200' };
    case 'info':
    default:
      return { bg: 'bg-blue-50', icon: 'ℹ️', border: 'border-blue-200' };
  }
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

// Generate notifications from assignments (called on demand)
function generateNotifications(
  assignments: NotificationCenterProps['assignments'],
  existingNotifications: Notification[]
): Notification[] {
  if (!assignments || assignments.length === 0) return existingNotifications;

  const now = new Date();
  const newNotifications: Notification[] = [];
  const existingIds = new Set(existingNotifications.map(n => n.assignmentId));

  assignments.forEach(a => {
    if (existingIds.has(a.id)) return;

    const hoursUntilDue = (a.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilDue <= 24 && hoursUntilDue > 0) {
      newNotifications.push({
        id: `notif-${a.id}-${now.getTime()}`,
        type: hoursUntilDue <= 6 ? 'urgent' : 'reminder',
        title: hoursUntilDue <= 6 ? 'Due Very Soon!' : 'Due Tomorrow',
        message: `${a.title} (${a.course}) is due ${hoursUntilDue <= 6 ? 'in a few hours' : 'soon'}`,
        timestamp: now,
        read: false,
        assignmentId: a.id,
      });
    }
  });

  if (newNotifications.length > 0) {
    const updated = [...newNotifications, ...existingNotifications];
    saveNotifications(updated);
    return updated;
  }
  return existingNotifications;
}

export default function NotificationCenter({ isOpen, onClose, assignments = [] }: NotificationCenterProps) {
  // Initialize state with stored data and generate notifications from assignments
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const stored = getStoredNotifications();
    return generateNotifications(assignments, stored);
  });
  const [permissionStatus, setPermissionStatus] = useState<string>(() =>
    typeof window !== 'undefined' ? getPermissionStatus() : 'default'
  );

  // Refresh function that can be called on demand (available for future use)
  const _refreshNotifications = useCallback(() => {
    const stored = getStoredNotifications();
    const updated = generateNotifications(assignments, stored);
    setNotifications(updated);
    setPermissionStatus(getPermissionStatus());
  }, [assignments]);

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    setPermissionStatus(granted ? 'granted' : 'denied');
  };

  const markAsRead = (id: string) => {
    const updated = notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    );
    setNotifications(updated);
    saveNotifications(updated);
  };

  const markAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    saveNotifications(updated);
  };

  const clearAll = () => {
    setNotifications([]);
    saveNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-gray-800 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Permission Banner */}
        {permissionStatus !== 'granted' && (
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 border-b border-indigo-100 dark:border-indigo-800">
            <div className="flex items-start gap-3">
              <span className="text-xl">🔔</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
                  Enable browser notifications
                </p>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                  Get notified about upcoming assignments even when the app is in the background.
                </p>
                <button
                  onClick={handleEnableNotifications}
                  className="mt-2 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Enable Notifications
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
            <button
              onClick={markAllAsRead}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Mark all as read
            </button>
            <button
              onClick={clearAll}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">No notifications yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                You&apos;ll see reminders for upcoming assignments here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {notifications.map(notification => {
                const styles = getTypeStyles(notification.type);
                return (
                  <div
                    key={notification.id}
                    onClick={() => markAsRead(notification.id)}
                    className={`p-4 cursor-pointer transition-colors ${
                      notification.read
                        ? 'bg-white dark:bg-gray-800'
                        : 'bg-indigo-50/50 dark:bg-indigo-900/20'
                    } hover:bg-gray-50 dark:hover:bg-gray-750`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg ${styles.bg} border ${styles.border} flex items-center justify-center flex-shrink-0`}>
                        <span>{styles.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm font-medium ${notification.read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white'}`}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <span className="w-2 h-2 bg-indigo-600 rounded-full flex-shrink-0"></span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {formatTimestamp(notification.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
          <a
            href="/setup#notifications"
            className="block w-full text-center text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Notification Settings →
          </a>
        </div>
      </div>
    </div>
  );
}

// Export a bell button component for use in the header
export function NotificationBell({
  onClick,
  unreadCount = 0,
}: {
  onClick: () => void;
  unreadCount?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="relative p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}

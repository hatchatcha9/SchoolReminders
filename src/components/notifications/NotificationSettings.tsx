'use client';

import { useState } from 'react';
import {
  getNotificationPrefs,
  saveNotificationPrefs,
  getPermissionStatus,
  requestPermission,
  supportsNotifications,
} from '@/lib/notifications';

interface ReminderSetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

const REMINDER_SETTINGS_KEY = 'school-reminder:reminder-settings';

function getDefaultReminderSettings(): ReminderSetting[] {
  return [
    {
      id: 'due-24h',
      label: '24 hours before due',
      description: 'Get notified one day before an assignment is due',
      enabled: true,
    },
    {
      id: 'due-6h',
      label: '6 hours before due',
      description: 'Get notified 6 hours before an assignment is due',
      enabled: true,
    },
    {
      id: 'due-1h',
      label: '1 hour before due',
      description: 'Get notified 1 hour before an assignment is due',
      enabled: true,
    },
    {
      id: 'lock-warning',
      label: 'Assignment locking soon',
      description: 'Get notified when an assignment is about to lock',
      enabled: true,
    },
    {
      id: 'test-reminder',
      label: 'Test/Quiz reminders',
      description: 'Get extra reminders for upcoming tests and quizzes',
      enabled: true,
    },
    {
      id: 'missing-alert',
      label: 'Missing assignment alerts',
      description: 'Get notified about assignments marked as missing',
      enabled: false,
    },
  ];
}

function loadReminderSettings(): ReminderSetting[] {
  if (typeof window === 'undefined') return getDefaultReminderSettings();
  try {
    const stored = localStorage.getItem(REMINDER_SETTINGS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // Ignore
  }
  return getDefaultReminderSettings();
}

function saveReminderSettings(settings: ReminderSetting[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore
  }
}

function getInitialQuietHours(): { enabled: boolean; start: string; end: string } {
  if (typeof window === 'undefined') return { enabled: false, start: '22:00', end: '07:00' };
  try {
    const quietHours = localStorage.getItem('school-reminder:quiet-hours');
    if (quietHours) {
      return JSON.parse(quietHours);
    }
  } catch {
    // Ignore
  }
  return { enabled: false, start: '22:00', end: '07:00' };
}

export default function NotificationSettings() {
  const [permissionStatus, setPermissionStatus] = useState<string>(() =>
    typeof window !== 'undefined' ? getPermissionStatus() : 'default'
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return getNotificationPrefs().enabled;
  });
  const [urgentOnly, setUrgentOnly] = useState(() => {
    if (typeof window === 'undefined') return false;
    return getNotificationPrefs().urgentOnly;
  });
  const [reminderSettings, setReminderSettings] = useState<ReminderSetting[]>(() => loadReminderSettings());
  const initialQuietHours = getInitialQuietHours();
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(initialQuietHours.enabled);
  const [quietHoursStart, setQuietHoursStart] = useState(initialQuietHours.start);
  const [quietHoursEnd, setQuietHoursEnd] = useState(initialQuietHours.end);
  const [saved, setSaved] = useState(false);

  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    setPermissionStatus(granted ? 'granted' : 'denied');
    if (granted) {
      setNotificationsEnabled(true);
    }
  };

  const handleToggleNotifications = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    saveNotificationPrefs({ enabled });
  };

  const handleToggleUrgentOnly = (enabled: boolean) => {
    setUrgentOnly(enabled);
    saveNotificationPrefs({ urgentOnly: enabled });
  };

  const handleToggleReminderSetting = (id: string) => {
    const updated = reminderSettings.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    setReminderSettings(updated);
    saveReminderSettings(updated);
  };

  const handleSaveQuietHours = () => {
    localStorage.setItem('school-reminder:quiet-hours', JSON.stringify({
      enabled: quietHoursEnabled,
      start: quietHoursStart,
      end: quietHoursEnd,
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const browserSupported = supportsNotifications();

  return (
    <div className="space-y-6">
      {/* Browser Support Check */}
      {!browserSupported && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-medium text-amber-800">Browser not supported</p>
              <p className="text-sm text-amber-700 mt-1">
                Your browser doesn&apos;t support notifications. Try using Chrome, Firefox, or Edge.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Permission Status */}
      {browserSupported && (
        <div className={`rounded-lg p-4 border ${
          permissionStatus === 'granted'
            ? 'bg-green-50 border-green-200'
            : permissionStatus === 'denied'
            ? 'bg-red-50 border-red-200'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {permissionStatus === 'granted' ? '✓' : permissionStatus === 'denied' ? '✗' : '🔔'}
              </span>
              <div>
                <p className={`font-medium ${
                  permissionStatus === 'granted'
                    ? 'text-green-800'
                    : permissionStatus === 'denied'
                    ? 'text-red-800'
                    : 'text-gray-800'
                }`}>
                  {permissionStatus === 'granted'
                    ? 'Notifications Enabled'
                    : permissionStatus === 'denied'
                    ? 'Notifications Blocked'
                    : 'Notifications Not Set Up'}
                </p>
                <p className={`text-sm ${
                  permissionStatus === 'granted'
                    ? 'text-green-700'
                    : permissionStatus === 'denied'
                    ? 'text-red-700'
                    : 'text-gray-600'
                }`}>
                  {permissionStatus === 'granted'
                    ? 'You will receive browser notifications for reminders.'
                    : permissionStatus === 'denied'
                    ? 'Please enable notifications in your browser settings.'
                    : 'Enable notifications to get reminders for assignments.'}
                </p>
              </div>
            </div>
            {permissionStatus === 'default' && (
              <button
                onClick={handleRequestPermission}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Enable
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Toggle */}
      {permissionStatus === 'granted' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">All Notifications</p>
              <p className="text-sm text-gray-500">Master switch for all notification types</p>
            </div>
            <button
              onClick={() => handleToggleNotifications(!notificationsEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                notificationsEnabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  notificationsEnabled ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Urgent Only Option */}
      {permissionStatus === 'granted' && notificationsEnabled && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Urgent Only Mode</p>
              <p className="text-sm text-gray-500">Only notify for high-priority items due within 24 hours</p>
            </div>
            <button
              onClick={() => handleToggleUrgentOnly(!urgentOnly)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                urgentOnly ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  urgentOnly ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Reminder Types */}
      {permissionStatus === 'granted' && notificationsEnabled && !urgentOnly && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-white">Reminder Types</h3>
            <p className="text-sm text-gray-500 mt-1">Choose which reminders you want to receive</p>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {reminderSettings.map(setting => (
              <div key={setting.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{setting.label}</p>
                  <p className="text-sm text-gray-500">{setting.description}</p>
                </div>
                <button
                  onClick={() => handleToggleReminderSetting(setting.id)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    setting.enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      setting.enabled ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quiet Hours */}
      {permissionStatus === 'granted' && notificationsEnabled && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Quiet Hours</h3>
                <p className="text-sm text-gray-500 mt-1">Don&apos;t send notifications during these hours</p>
              </div>
              <button
                onClick={() => setQuietHoursEnabled(!quietHoursEnabled)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  quietHoursEnabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    quietHoursEnabled ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
          {quietHoursEnabled && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={quietHoursStart}
                    onChange={(e) => setQuietHoursStart(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={quietHoursEnd}
                    onChange={(e) => setQuietHoursEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveQuietHours}
                className="w-full px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {saved ? '✓ Saved!' : 'Save Quiet Hours'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Test Notification */}
      {permissionStatus === 'granted' && notificationsEnabled && (
        <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-200">Test Notification</p>
              <p className="text-sm text-gray-500">Send a test notification to verify it&apos;s working</p>
            </div>
            <button
              onClick={() => {
                new Notification('School Reminder - Test', {
                  body: 'Notifications are working correctly!',
                  icon: '/favicon.ico',
                });
              }}
              className="px-4 py-2 text-sm font-medium border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              Send Test
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

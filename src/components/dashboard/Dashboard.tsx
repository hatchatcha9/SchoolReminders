'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AssignmentDetailModal from '@/components/assignments/AssignmentDetailModal';
import AIAssistantModal from '@/components/ai/AIAssistantModal';
import {
  shouldPromptForNotifications,
  requestPermission,
  scheduleUrgentNotifications,
  getNotificationPrefs,
  saveNotificationPrefs,
} from '@/lib/notifications';
import { syncService } from '@/lib/sync';
import { dataCache, CACHE_KEYS } from '@/lib/cache';
import { useReminders } from '@/hooks/useReminders';
import LockingAlerts from '@/components/reminders/LockingAlerts';
import UrgentAlerts from '@/components/reminders/UrgentAlerts';
import { useAuth } from '@/components/auth';

interface Assignment {
  id: string;
  title: string;
  course: string;
  dueDate: Date;
  type: 'test' | 'quiz' | 'assignment';
  priority: 'high' | 'medium' | 'low';
  lockDate?: Date;
  description?: string;
  pointsPossible?: number;
  submission?: {
    submitted: boolean;
    late: boolean;
    missing: boolean;
    score: number | null;
    grade: string | null;
  };
}

interface Course {
  id: number;
  name: string;
  code: string;
  currentScore: number | null;
  currentGrade: string | null;
}

interface CanvasAssignment {
  id: number;
  name: string;
  courseName: string;
  due_at: string;
  lock_at?: string;
  description?: string;
  points_possible?: number;
  submission?: {
    submitted: boolean;
    late: boolean;
    missing: boolean;
    score: number | null;
    grade: string | null;
  };
}

// Mock data - used when not connected
const mockAssignments: Assignment[] = [
  {
    id: '1',
    title: 'Chapter 5 Reading Quiz',
    course: 'AP US History',
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
    type: 'quiz',
    priority: 'high',
  },
  {
    id: '2',
    title: 'Lab Report: Chemical Reactions',
    course: 'Chemistry',
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
    type: 'assignment',
    priority: 'medium',
  },
  {
    id: '3',
    title: 'Essay Draft - The Great Gatsby',
    course: 'English 11',
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
    type: 'assignment',
    priority: 'medium',
  },
  {
    id: '4',
    title: 'Unit 4 Test - Derivatives',
    course: 'Calculus',
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
    type: 'test',
    priority: 'high',
  },
  {
    id: '5',
    title: 'Spanish Vocab Practice',
    course: 'Spanish 3',
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1),
    type: 'assignment',
    priority: 'low',
  },
];

function formatDate(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return 'Overdue!';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;
  return date.toLocaleDateString();
}

function getPriorityFromDays(days: number): 'high' | 'medium' | 'low' {
  if (days <= 1) return 'high';
  if (days <= 3) return 'medium';
  return 'low';
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-800 border-red-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'test': return '📝';
    case 'quiz': return '❓';
    case 'assignment': return '📄';
    default: return '📌';
  }
}

function getSubmissionStatus(submission?: Assignment['submission']): { icon: string; label: string; color: string } | null {
  if (!submission) return null;

  if (submission.submitted) {
    if (submission.late) {
      return { icon: '⚠️', label: 'Late', color: 'text-amber-600 bg-amber-50' };
    }
    return { icon: '✓', label: 'Submitted', color: 'text-green-600 bg-green-50' };
  }

  if (submission.missing) {
    return { icon: '✗', label: 'Missing', color: 'text-red-600 bg-red-50' };
  }

  return null;
}

function detectAssignmentType(name: string): 'test' | 'quiz' | 'assignment' {
  const lower = name.toLowerCase();
  if (lower.includes('test') || lower.includes('exam')) return 'test';
  if (lower.includes('quiz')) return 'quiz';
  return 'assignment';
}

function formatCanvasAssignments(rawAssignments: CanvasAssignment[]): Assignment[] {
  return rawAssignments.map((a) => {
    const dueDate = new Date(a.due_at);
    const now = new Date();
    const days = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      id: String(a.id),
      title: a.name,
      course: a.courseName,
      dueDate,
      lockDate: a.lock_at ? new Date(a.lock_at) : undefined,
      description: a.description,
      pointsPossible: a.points_possible,
      type: detectAssignmentType(a.name),
      priority: getPriorityFromDays(days),
      submission: a.submission,
    };
  });
}

export default function Dashboard() {
  const { connectedServices, isLoading: authLoading, refreshSession } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [hasRealData, setHasRealData] = useState(false); // Track if we have real Canvas data
  const [_courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiContext, setAIContext] = useState<{ assignment?: Assignment; mode?: 'help' | 'study' }>({});

  // Notification and overview states
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [dailyOverview, setDailyOverview] = useState<string | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // Sync state
  const [lastSyncTime, setLastSyncTime] = useState<string>('Never');
  const [syncing, setSyncing] = useState(false);

  // Connection status from auth context
  const canvasConnected = connectedServices.includes('canvas');
  const connected = canvasConnected;

  // Reminders system
  const { lockingSoon, urgent, sendReminder } = useReminders(assignments);

  useEffect(() => {
    if (authLoading) return;

    if (canvasConnected) {
      // Try to load from cache first for faster initial render
      const cachedAssignments = dataCache.get<CanvasAssignment[]>(CACHE_KEYS.CANVAS_ASSIGNMENTS);
      if (cachedAssignments && cachedAssignments.length > 0) {
        const formattedAssignments = formatCanvasAssignments(cachedAssignments);
        setAssignments(formattedAssignments);
        setHasRealData(true); // Cached data is also real data
        setLoading(false);

        // Still fetch fresh data in background if cache is stale
        if (dataCache.isStale(CACHE_KEYS.CANVAS_ASSIGNMENTS, 5 * 60 * 1000)) {
          fetchAssignments();
        }
      } else {
        fetchAssignments();
      }

      fetchCourses();
    } else {
      // Not connected - show mock data for demo
      setAssignments(mockAssignments);
      setLoading(false);
    }

    // Update last sync time
    setLastSyncTime(syncService.getTimeSinceLastSync());

    // Check if we should show notification prompt
    if (shouldPromptForNotifications()) {
      setShowNotificationPrompt(true);
    }
  }, [authLoading, canvasConnected]);

  const fetchDailyOverview = useCallback(async () => {
    // Don't fetch if we don't have real data
    if (!hasRealData) return;

    // Check cache first
    const cacheKey = `daily-overview-${new Date().toDateString()}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setDailyOverview(cached);
      return;
    }

    setLoadingOverview(true);
    try {
      const response = await fetch('/api/ai/overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments: assignments.map(a => ({
            title: a.title,
            course: a.course,
            dueDate: a.dueDate.toLocaleDateString(),
            type: a.type,
            priority: a.priority,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setDailyOverview(data.overview);
        localStorage.setItem(cacheKey, data.overview);
      }
    } catch (err) {
      console.error('Error fetching overview:', err);
    } finally {
      setLoadingOverview(false);
    }
  }, [assignments, hasRealData]);

  // Schedule notifications and fetch overview when real assignments are loaded
  useEffect(() => {
    if (assignments.length > 0 && connected && hasRealData) {
      // Schedule notifications for urgent items
      const prefs = getNotificationPrefs();
      if (prefs.enabled) {
        scheduleUrgentNotifications(assignments);
      }

      // Fetch daily overview only when we have real data
      fetchDailyOverview();
    }
  }, [assignments, connected, hasRealData, fetchDailyOverview]);

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      scheduleUrgentNotifications(assignments);
    }
    setShowNotificationPrompt(false);
  };

  const handleDismissNotificationPrompt = () => {
    saveNotificationPrefs({ lastPrompt: Date.now() });
    setShowNotificationPrompt(false);
  };

  const fetchCourses = async () => {
    try {
      const response = await fetch('/api/canvas/courses');
      if (response.ok) {
        const data = await response.json();
        setCourses(data.courses || []);
      }
    } catch (err) {
      console.error('Error fetching courses:', err);
    }
  };

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/canvas/assignments?days=14');

      if (!response.ok) {
        throw new Error('Failed to fetch assignments');
      }

      const data = await response.json();

      // Cache the raw data
      dataCache.set(CACHE_KEYS.CANVAS_ASSIGNMENTS, data.assignments, { ttl: 5 * 60 * 1000 });

      const formattedAssignments = formatCanvasAssignments(data.assignments);
      setAssignments(formattedAssignments);
      setHasRealData(true); // Mark that we have real Canvas data
      setError(null);

      // Update last sync time
      setLastSyncTime('Just now');
    } catch (err) {
      console.error('Error fetching assignments:', err);
      setError('Failed to load assignments from Canvas');
      setAssignments(mockAssignments);
      setHasRealData(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!canvasConnected) return;

    setSyncing(true);
    try {
      // Refetch from API
      await fetchAssignments();
      setLastSyncTime('Just now');
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  const disconnect = async () => {
    try {
      await fetch('/api/credentials?service=canvas', { method: 'DELETE' });
      await refreshSession();
      setAssignments(mockAssignments);
      setHasRealData(false);
      setDailyOverview(null);
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  };

  // Calculate stats
  const urgentCount = assignments.filter(a => a.priority === 'high').length;
  const testCount = assignments.filter(a => a.type === 'test' || a.type === 'quiz').length;

  // Generate reminders from assignments
  const reminders = assignments
    .filter(a => {
      const days = Math.floor((a.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return days <= 2;
    })
    .slice(0, 3)
    .map((a, i) => ({
      id: String(i),
      message: a.lockDate
        ? `${a.title} locks ${formatDate(a.lockDate)}!`
        : `${a.title} due ${formatDate(a.dueDate)}`,
      type: a.priority === 'high' ? 'urgent' : a.priority === 'medium' ? 'warning' : 'info',
    }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Page Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Dashboard
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {connected ? 'Connected to Canvas' : 'Stay on top of your assignments'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {connected && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>Last sync: {lastSyncTime}</span>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    title="Sync now"
                  >
                    <svg
                      className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                </div>
              )}
              {connected ? (
                <button
                  onClick={disconnect}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-green-100 text-green-700 border border-green-300 hover:bg-green-200 transition-colors"
                >
                  ✓ Connected
                </button>
              ) : (
                <Link
                  href="/setup"
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  Connect Canvas
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <span className="text-red-500 text-xl">⚠️</span>
            <div>
              <p className="text-red-800 font-medium">Error loading data</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Status Banner */}
        {!connected && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
            <span className="text-amber-500 text-xl">⚠️</span>
            <div>
              <p className="text-amber-800 font-medium">Connect your accounts</p>
              <p className="text-amber-600 text-sm">
                <Link href="/setup" className="underline hover:no-underline">
                  Link Canvas
                </Link>{' '}
                to see your real assignments and grades. Showing demo data for now.
              </p>
            </div>
          </div>
        )}

        {/* Notification Permission Prompt */}
        {showNotificationPrompt && (
          <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-indigo-500 text-xl">🔔</span>
              <div>
                <p className="text-indigo-800 font-medium">Enable notifications</p>
                <p className="text-indigo-600 text-sm">
                  Get reminded about urgent assignments before they&apos;re due.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDismissNotificationPrompt}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Not now
              </button>
              <button
                onClick={handleEnableNotifications}
                className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Enable
              </button>
            </div>
          </div>
        )}

        {/* Locking Soon Alerts */}
        {connected && lockingSoon.length > 0 && (
          <div className="mb-6">
            <LockingAlerts
              assignments={lockingSoon}
              onViewAssignment={(a) => {
                setSelectedAssignment(a as Assignment);
                setShowAssignmentModal(true);
              }}
            />
          </div>
        )}

        {/* Urgent Assignments Alert */}
        {connected && urgent.length > 0 && (
          <div className="mb-6">
            <UrgentAlerts
              assignments={urgent}
              onViewAssignment={(a) => {
                setSelectedAssignment(a as Assignment);
                setShowAssignmentModal(true);
              }}
              onSendReminder={sendReminder}
            />
          </div>
        )}

        {/* Daily Overview */}
        {connected && dailyOverview && (
          <div className="mb-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✨</span>
              <div>
                <p className="font-medium mb-1">Your Daily Overview</p>
                <p className="text-indigo-100">{dailyOverview}</p>
              </div>
            </div>
          </div>
        )}
        {connected && loadingOverview && !dailyOverview && (
          <div className="mb-6 bg-gray-100 dark:bg-gray-700 rounded-xl p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your assignments...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - Assignments */}
            <div className="lg:col-span-2 space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <p className="text-3xl font-bold text-indigo-600">{assignments.length}</p>
                  <p className="text-sm text-gray-500">Due Soon</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <p className="text-3xl font-bold text-red-500">{urgentCount}</p>
                  <p className="text-sm text-gray-500">Urgent</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <p className="text-3xl font-bold text-green-500">{testCount}</p>
                  <p className="text-sm text-gray-500">Tests/Quizzes</p>
                </div>
              </div>

              {/* Upcoming Assignments */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Upcoming Assignments
                    {!connected && <span className="text-sm font-normal text-gray-500 ml-2">(Demo)</span>}
                  </h2>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {assignments.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No upcoming assignments! 🎉
                    </div>
                  ) : (
                    assignments.map((assignment) => {
                      const submissionStatus = getSubmissionStatus(assignment.submission);
                      return (
                        <div
                          key={assignment.id}
                          onClick={() => {
                            setSelectedAssignment(assignment);
                            setShowAssignmentModal(true);
                          }}
                          className="p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <span className="text-2xl">{getTypeIcon(assignment.type)}</span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium text-gray-900 dark:text-white">
                                    {assignment.title}
                                  </h3>
                                  {submissionStatus && (
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${submissionStatus.color}`}>
                                      {submissionStatus.icon} {submissionStatus.label}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">{assignment.course}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(
                                  assignment.priority
                                )}`}
                              >
                                {formatDate(assignment.dueDate)}
                              </span>
                              {assignment.type === 'test' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAIContext({ assignment, mode: 'study' });
                                    setShowAIModal(true);
                                  }}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                  Get Study Tips →
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Reminders */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Reminders
                  </h2>
                </div>
                <div className="p-4 space-y-3">
                  {reminders.length === 0 ? (
                    <p className="text-sm text-gray-500">No urgent reminders</p>
                  ) : (
                    reminders.map((reminder) => (
                      <div
                        key={reminder.id}
                        className={`p-3 rounded-lg text-sm ${
                          reminder.type === 'urgent'
                            ? 'bg-red-50 text-red-800 border border-red-200'
                            : reminder.type === 'warning'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {reminder.message}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* AI Assistant */}
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-sm p-4 text-white">
                <h2 className="text-lg font-semibold mb-2">AI Study Assistant</h2>
                <p className="text-sm text-indigo-100 mb-4">
                  Get help with homework, study strategies, and assignment summaries.
                </p>
                <button
                  onClick={() => {
                    setAIContext({ mode: 'help' });
                    setShowAIModal(true);
                  }}
                  className="w-full bg-white text-indigo-600 font-medium py-2 px-4 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Ask for Help
                </button>
              </div>

              {/* Quick Actions */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Quick Actions
                </h2>
                <div className="space-y-2">
                  <Link href="/calendar" className="block w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 transition-colors">
                    📅 View Calendar
                  </Link>
                  <Link href="/grades" className="block w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 transition-colors">
                    📊 Check Grades
                  </Link>
                  <Link href="/setup" className="block w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 transition-colors">
                    🔔 Manage Connections
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Assignment Detail Modal */}
      {showAssignmentModal && selectedAssignment && (
        <AssignmentDetailModal
          assignment={selectedAssignment}
          onClose={() => {
            setShowAssignmentModal(false);
            setSelectedAssignment(null);
          }}
          onGetHelp={() => {
            setAIContext({ assignment: selectedAssignment, mode: 'help' });
            setShowAssignmentModal(false);
            setShowAIModal(true);
          }}
          onGetStudyTips={() => {
            setAIContext({ assignment: selectedAssignment, mode: 'study' });
            setShowAssignmentModal(false);
            setShowAIModal(true);
          }}
        />
      )}

      {/* AI Assistant Modal */}
      {showAIModal && (
        <AIAssistantModal
          assignment={aiContext.assignment}
          mode={aiContext.mode || 'help'}
          onClose={() => {
            setShowAIModal(false);
            setAIContext({});
          }}
        />
      )}
    </div>
  );
}

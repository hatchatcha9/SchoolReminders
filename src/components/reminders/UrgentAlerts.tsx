'use client';

import { useState, useEffect } from 'react';

interface Assignment {
  id: string;
  title: string;
  course: string;
  dueDate: Date;
  type?: 'test' | 'quiz' | 'assignment';
}

interface UrgentAlertsProps {
  assignments: Assignment[];
  onViewAssignment?: (assignment: Assignment) => void;
  onSendReminder?: (assignment: Assignment) => void;
}

function formatTimeRemaining(date: Date): string {
  const now = Date.now();
  const time = new Date(date).getTime();
  const diff = time - now;

  if (diff < 0) return 'Overdue';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours >= 1) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getTypeIcon(type?: string): string {
  switch (type) {
    case 'test': return '📝';
    case 'quiz': return '❓';
    default: return '📄';
  }
}

export default function UrgentAlerts({ assignments, onViewAssignment, onSendReminder }: UrgentAlertsProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Filter to assignments due within 24 hours
  const twentyFourHours = 24 * 60 * 60 * 1000;
  const urgentAssignments = assignments.filter(a => {
    const dueTime = new Date(a.dueDate).getTime();
    return dueTime > currentTime && dueTime - currentTime <= twentyFourHours;
  });

  if (urgentAssignments.length === 0) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-3 flex items-center justify-between bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          <span className="font-semibold text-amber-800 dark:text-amber-200">
            {urgentAssignments.length} Due Within 24 Hours
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-amber-600 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {!collapsed && (
        <div className="p-3 space-y-2">
          {urgentAssignments.map(assignment => {
            const timeLeft = formatTimeRemaining(assignment.dueDate);
            const isVeryUrgent = new Date(assignment.dueDate).getTime() - currentTime < 6 * 60 * 60 * 1000;

            return (
              <div
                key={assignment.id}
                className={`rounded-lg p-3 flex items-center gap-3 ${
                  isVeryUrgent
                    ? 'bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
                    : 'bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800'
                }`}
              >
                <span className="text-xl flex-shrink-0">{getTypeIcon(assignment.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${
                    isVeryUrgent ? 'text-red-800 dark:text-red-200' : 'text-gray-900 dark:text-white'
                  }`}>
                    {assignment.title}
                  </p>
                  <p className={`text-sm ${
                    isVeryUrgent ? 'text-red-600 dark:text-red-300' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {assignment.course}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-sm font-bold ${
                    isVeryUrgent ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'
                  }`}>
                    {timeLeft}
                  </span>
                  {onSendReminder && (
                    <button
                      onClick={() => onSendReminder(assignment)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      title="Send reminder notification"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </button>
                  )}
                  {onViewAssignment && (
                    <button
                      onClick={() => onViewAssignment(assignment)}
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        isVeryUrgent
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-amber-600 text-white hover:bg-amber-700'
                      }`}
                    >
                      View
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';

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

interface CalendarViewProps {
  assignments: Assignment[];
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'test': return 'bg-red-100 text-red-800 border-red-300';
    case 'quiz': return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'assignment': return 'bg-blue-100 text-blue-800 border-blue-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
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

export default function CalendarView({ assignments }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get first day of month and number of days
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  // Create calendar grid
  const calendarDays: (number | null)[] = [];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Get assignments for a specific date
  const getAssignmentsForDate = (day: number): Assignment[] => {
    return assignments.filter(a => {
      const dueDate = new Date(a.dueDate);
      return (
        dueDate.getFullYear() === year &&
        dueDate.getMonth() === month &&
        dueDate.getDate() === day
      );
    });
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (day: number): boolean => {
    const today = new Date();
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    );
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Calendar Header */}
      <div className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {monthNames[month]} {year}
        </h2>
        <button
          onClick={goToToday}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Today
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
        {dayNames.map(day => (
          <div
            key={day}
            className="py-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, index) => {
          const dayAssignments = day ? getAssignmentsForDate(day) : [];
          const isPast = day ? new Date(year, month, day) < new Date(new Date().setHours(0, 0, 0, 0)) : false;

          return (
            <div
              key={index}
              className={`min-h-[100px] border-b border-r border-gray-200 dark:border-gray-700 p-1 ${
                day === null ? 'bg-gray-50 dark:bg-gray-750' : ''
              } ${isPast && day !== null ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}`}
            >
              {day !== null && (
                <>
                  <div className={`text-right mb-1 ${
                    isToday(day)
                      ? 'text-white'
                      : isPast
                      ? 'text-gray-400 dark:text-gray-500'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium ${
                      isToday(day) ? 'bg-indigo-600' : ''
                    }`}>
                      {day}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayAssignments.slice(0, 3).map(assignment => (
                      <button
                        key={assignment.id}
                        onClick={() => setSelectedAssignment(assignment)}
                        className={`w-full text-left text-xs px-1.5 py-0.5 rounded border truncate ${getTypeColor(assignment.type)} hover:opacity-80 transition-opacity`}
                      >
                        {getTypeIcon(assignment.type)} {assignment.title}
                      </button>
                    ))}
                    {dayAssignments.length > 3 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
                        +{dayAssignments.length - 3} more
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="bg-gray-50 dark:bg-gray-750 border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-4 flex-wrap">
        <span className="text-sm text-gray-500 dark:text-gray-400">Legend:</span>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-200 border border-red-300"></span>
          <span className="text-sm text-gray-600 dark:text-gray-300">Test</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-200 border border-amber-300"></span>
          <span className="text-sm text-gray-600 dark:text-gray-300">Quiz</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-200 border border-blue-300"></span>
          <span className="text-sm text-gray-600 dark:text-gray-300">Assignment</span>
        </div>
      </div>

      {/* Assignment Detail Popup */}
      {selectedAssignment && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setSelectedAssignment(null)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <button
                onClick={() => setSelectedAssignment(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{getTypeIcon(selectedAssignment.type)}</span>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedAssignment.title}
                </h3>
              </div>

              <div className="space-y-2 text-sm">
                <p className="text-gray-600 dark:text-gray-300">
                  <span className="font-medium">Course:</span> {selectedAssignment.course}
                </p>
                <p className="text-gray-600 dark:text-gray-300">
                  <span className="font-medium">Due:</span>{' '}
                  {selectedAssignment.dueDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
                {selectedAssignment.pointsPossible !== undefined && selectedAssignment.pointsPossible > 0 && (
                  <p className="text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Points:</span> {selectedAssignment.pointsPossible}
                  </p>
                )}
                {selectedAssignment.submission && (
                  <p className={`font-medium ${
                    selectedAssignment.submission.submitted
                      ? selectedAssignment.submission.late
                        ? 'text-amber-600'
                        : 'text-green-600'
                      : selectedAssignment.submission.missing
                      ? 'text-red-600'
                      : 'text-gray-500'
                  }`}>
                    Status:{' '}
                    {selectedAssignment.submission.submitted
                      ? selectedAssignment.submission.late ? 'Submitted (Late)' : 'Submitted'
                      : selectedAssignment.submission.missing
                      ? 'Missing'
                      : 'Not Submitted'}
                  </p>
                )}
              </div>

              {selectedAssignment.description && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-4">
                    {selectedAssignment.description.replace(/<[^>]*>/g, '').trim() || 'No description'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

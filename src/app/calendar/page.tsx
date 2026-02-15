'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import CalendarView from '@/components/calendar/CalendarView';

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

type ViewMode = 'calendar' | 'list';
type SortOption = 'dueDate' | 'course' | 'type' | 'priority';

function detectAssignmentType(name: string): 'test' | 'quiz' | 'assignment' {
  const lower = name.toLowerCase();
  if (lower.includes('test') || lower.includes('exam')) return 'test';
  if (lower.includes('quiz')) return 'quiz';
  return 'assignment';
}

function getPriorityFromDays(days: number): 'high' | 'medium' | 'low' {
  if (days <= 1) return 'high';
  if (days <= 3) return 'medium';
  return 'low';
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'test': return '📝';
    case 'quiz': return '❓';
    case 'assignment': return '📄';
    default: return '📌';
  }
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'test': return 'bg-red-100 text-red-800 border-red-300';
    case 'quiz': return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'assignment': return 'bg-blue-100 text-blue-800 border-blue-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'low': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return 'Overdue';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;
  return date.toLocaleDateString();
}

export default function CalendarPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  // View and filter state
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCourse, setFilterCourse] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('dueDate');
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('canvasToken');
    if (token) {
      setConnected(true);
      fetchAssignments(token);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchAssignments = async (token: string) => {
    try {
      const response = await fetch('/api/canvas/assignments?days=60', {
        headers: { 'x-canvas-token': token },
      });

      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      const formattedAssignments: Assignment[] = data.assignments.map((a: {
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
      }) => {
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

      setAssignments(formattedAssignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique courses for filter dropdown
  const courses = useMemo(() => {
    const uniqueCourses = [...new Set(assignments.map(a => a.course))];
    return uniqueCourses.sort();
  }, [assignments]);

  // Filter and sort assignments
  const filteredAssignments = useMemo(() => {
    let filtered = [...assignments];

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(a => a.type === filterType);
    }

    // Apply course filter
    if (filterCourse !== 'all') {
      filtered = filtered.filter(a => a.course === filterCourse);
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(a => {
        if (filterStatus === 'submitted') return a.submission?.submitted;
        if (filterStatus === 'not-submitted') return !a.submission?.submitted;
        if (filterStatus === 'missing') return a.submission?.missing;
        if (filterStatus === 'late') return a.submission?.late;
        return true;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'dueDate':
          comparison = a.dueDate.getTime() - b.dueDate.getTime();
          break;
        case 'course':
          comparison = a.course.localeCompare(b.course);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'priority':
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
      }
      return sortAsc ? comparison : -comparison;
    });

    return filtered;
  }, [assignments, filterType, filterCourse, filterStatus, sortBy, sortAsc]);

  const toggleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(option);
      setSortAsc(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Page Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Calendar
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {connected ? `${filteredAssignments.length} of ${assignments.length} assignments` : 'View all your upcoming assignments'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'calendar'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                  }`}
                >
                  Calendar
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                  }`}
                >
                  List
                </button>
              </div>
              {connected && (
                <button
                  onClick={() => fetchAssignments(localStorage.getItem('canvasToken') || '')}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {!connected && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
            <span className="text-amber-500 text-xl">⚠️</span>
            <div>
              <p className="text-amber-800 font-medium">Not connected to Canvas</p>
              <p className="text-amber-600 text-sm">
                <Link href="/setup" className="underline hover:no-underline">
                  Connect your Canvas account
                </Link>{' '}
                to see your assignments on the calendar.
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        {connected && !loading && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>

              {/* Type Filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Types</option>
                <option value="assignment">Assignments</option>
                <option value="quiz">Quizzes</option>
                <option value="test">Tests</option>
              </select>

              {/* Course Filter */}
              <select
                value={filterCourse}
                onChange={(e) => setFilterCourse(e.target.value)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Courses</option>
                {courses.map(course => (
                  <option key={course} value={course}>{course}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="not-submitted">Not Submitted</option>
                <option value="submitted">Submitted</option>
                <option value="missing">Missing</option>
                <option value="late">Late</option>
              </select>

              {/* Clear Filters */}
              {(filterType !== 'all' || filterCourse !== 'all' || filterStatus !== 'all') && (
                <button
                  onClick={() => {
                    setFilterType('all');
                    setFilterCourse('all');
                    setFilterStatus('all');
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading calendar...</p>
            </div>
          </div>
        ) : viewMode === 'calendar' ? (
          <CalendarView assignments={filteredAssignments} />
        ) : (
          /* List View */
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* List Header with Sort Options */}
            <div className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-500 dark:text-gray-400">Sort by:</span>
                {(['dueDate', 'course', 'type', 'priority'] as SortOption[]).map(option => (
                  <button
                    key={option}
                    onClick={() => toggleSort(option)}
                    className={`flex items-center gap-1 px-2 py-1 rounded ${
                      sortBy === option
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {option === 'dueDate' ? 'Due Date' : option.charAt(0).toUpperCase() + option.slice(1)}
                    {sortBy === option && (
                      <svg className={`w-4 h-4 ${sortAsc ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignment List */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAssignments.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No assignments match your filters
                </div>
              ) : (
                filteredAssignments.map(assignment => (
                  <div
                    key={assignment.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-2xl flex-shrink-0">{getTypeIcon(assignment.type)}</span>
                        <div className="min-w-0">
                          <h3 className="font-medium text-gray-900 dark:text-white truncate">
                            {assignment.title}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{assignment.course}</p>
                          {assignment.submission && (
                            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${
                              assignment.submission.submitted
                                ? assignment.submission.late
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-green-100 text-green-700'
                                : assignment.submission.missing
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {assignment.submission.submitted
                                ? assignment.submission.late ? 'Late' : 'Submitted'
                                : assignment.submission.missing ? 'Missing' : 'Not Submitted'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(assignment.priority)}`}>
                          {formatDate(assignment.dueDate)}
                        </span>
                        <span className={`px-2 py-0.5 rounded border text-xs ${getTypeColor(assignment.type)}`}>
                          {assignment.type}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

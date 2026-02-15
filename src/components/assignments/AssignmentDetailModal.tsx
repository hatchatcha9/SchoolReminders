'use client';

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

interface AssignmentDetailModalProps {
  assignment: Assignment;
  onClose: () => void;
  onGetHelp: () => void;
  onGetStudyTips: () => void;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getSubmissionStatusDisplay(submission?: Assignment['submission']): { text: string; color: string; bgColor: string } | null {
  if (!submission) return null;

  if (submission.submitted) {
    if (submission.late) {
      return { text: 'Submitted Late', color: 'text-amber-700', bgColor: 'bg-amber-100 border-amber-300' };
    }
    return { text: 'Submitted', color: 'text-green-700', bgColor: 'bg-green-100 border-green-300' };
  }

  if (submission.missing) {
    return { text: 'Missing', color: 'text-red-700', bgColor: 'bg-red-100 border-red-300' };
  }

  return { text: 'Not Submitted', color: 'text-gray-600', bgColor: 'bg-gray-100 border-gray-300' };
}

export default function AssignmentDetailModal({
  assignment,
  onClose,
  onGetHelp,
  onGetStudyTips,
}: AssignmentDetailModalProps) {
  const submissionStatus = getSubmissionStatusDisplay(assignment.submission);
  const isTest = assignment.type === 'test' || assignment.type === 'quiz';

  // Strip HTML from description
  const cleanDescription = assignment.description
    ? assignment.description.replace(/<[^>]*>/g, '').trim()
    : 'No description provided.';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">
                  {assignment.type === 'test' ? '📝' : assignment.type === 'quiz' ? '❓' : '📄'}
                </span>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {assignment.title}
                </h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {assignment.course}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Status and Points */}
            <div className="flex flex-wrap gap-3">
              {submissionStatus && (
                <div className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${submissionStatus.bgColor} ${submissionStatus.color}`}>
                  {submissionStatus.text}
                  {assignment.submission?.score !== null && assignment.submission?.score !== undefined && (
                    <span className="ml-2">
                      ({assignment.submission.score}/{assignment.pointsPossible} pts)
                    </span>
                  )}
                  {assignment.submission?.grade && (
                    <span className="ml-1">- {assignment.submission.grade}</span>
                  )}
                </div>
              )}
              {assignment.pointsPossible !== undefined && assignment.pointsPossible > 0 && (
                <div className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-medium">
                  {assignment.pointsPossible} points possible
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Due Date
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatDate(assignment.dueDate)}
                </p>
              </div>
              {assignment.lockDate && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
                  <p className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">
                    Locks At
                  </p>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    {formatDate(assignment.lockDate)}
                  </p>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </h3>
              <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {cleanDescription}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={onGetHelp}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Get AI Help
              </button>
              {isTest && (
                <button
                  onClick={onGetStudyTips}
                  className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Get Study Tips
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

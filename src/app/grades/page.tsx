'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth';

interface QuarterGrade {
  quarter: string;
  letter: string | null;
  isCurrent: boolean;
}

interface SkywardCourse {
  name: string;
  period: string;
  teacher: string;
  grades: QuarterGrade[];
}

interface CanvasCourse {
  id: number;
  name: string;
  code: string;
  currentScore: number | null;
  currentGrade: string | null;
  finalScore: number | null;
  finalGrade: string | null;
}

interface MissingAssignment {
  name: string;
  course: string;
  teacher: string;
  dueDate: string;
}

type DataSource = 'canvas' | 'skyward' | 'none';

// Grade points for GPA calculation
const gradePoints: Record<string, number> = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7,
  'D+': 1.3, 'D': 1.0, 'D-': 0.7,
  'F': 0.0
};

function getGradeColor(letter: string | null): string {
  if (!letter) return 'text-gray-400 bg-gray-50';
  const grade = letter.charAt(0).toUpperCase();
  switch (grade) {
    case 'A': return 'text-green-700 bg-green-100';
    case 'B': return 'text-blue-700 bg-blue-100';
    case 'C': return 'text-yellow-700 bg-yellow-100';
    case 'D': return 'text-orange-700 bg-orange-100';
    case 'F': return 'text-red-700 bg-red-100';
    default: return 'text-gray-700 bg-gray-100';
  }
}

function calculateGPA(courses: SkywardCourse[]): string {
  let totalPoints = 0;
  let count = 0;

  courses.forEach(course => {
    // Get the most recent grade (current quarter or latest available)
    const currentGrade = course.grades.find(g => g.isCurrent && g.letter) ||
                         course.grades.filter(g => g.letter).pop();
    if (currentGrade?.letter) {
      const points = gradePoints[currentGrade.letter.toUpperCase()];
      if (points !== undefined) {
        totalPoints += points;
        count++;
      }
    }
  });

  return count > 0 ? (totalPoints / count).toFixed(2) : 'N/A';
}

export default function GradesPage() {
  const { connectedServices } = useAuth();

  // Skyward state
  const [skywardCourses, setSkywardCourses] = useState<SkywardCourse[]>([]);
  const [missingAssignments, setMissingAssignments] = useState<MissingAssignment[]>([]);
  const [studentName, setStudentName] = useState('');
  const [school, setSchool] = useState('');

  // Canvas state
  const [canvasCourses, setCanvasCourses] = useState<CanvasCourse[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [_dataSource, setDataSource] = useState<DataSource>('none');
  const [activeTab, setActiveTab] = useState<'canvas' | 'skyward'>('canvas');

  // Connection states from auth
  const canvasConnected = connectedServices.includes('canvas');
  const skywardConnected = connectedServices.includes('skyward');

  // Grade calculator state
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [selectedSkywardCourse, setSelectedSkywardCourse] = useState<SkywardCourse | null>(null);
  const [hypotheticalGrades, setHypotheticalGrades] = useState<Record<string, string>>({});

  useEffect(() => {
    // Prefer Canvas if connected, fall back to Skyward
    if (canvasConnected) {
      setActiveTab('canvas');
      fetchCanvasGrades();
    } else if (skywardConnected) {
      setActiveTab('skyward');
      fetchSkywardGrades();
    } else {
      setLoading(false);
    }
  }, [canvasConnected, skywardConnected]);

  const fetchCanvasGrades = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/canvas/courses');

      if (!response.ok) {
        throw new Error('Failed to fetch Canvas grades');
      }

      const data = await response.json();
      setCanvasCourses(data.courses || []);
      setDataSource('canvas');
    } catch (err) {
      console.error('Error fetching Canvas grades:', err);
      setError(err instanceof Error ? err.message : 'Failed to load Canvas grades');
    } finally {
      setLoading(false);
    }
  };

  const fetchSkywardGrades = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/skyward/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch grades');
      }

      const data = await response.json();
      setSkywardCourses(data.courses || []);
      setMissingAssignments(data.missingAssignments || []);
      setStudentName(data.studentName || '');
      setSchool(data.school || '');
      setDataSource('skyward');
    } catch (err) {
      console.error('Error fetching Skyward grades:', err);
      setError(err instanceof Error ? err.message : 'Failed to load Skyward grades');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: 'canvas' | 'skyward') => {
    setActiveTab(tab);
    setError(null);

    if (tab === 'canvas' && canvasConnected) {
      if (canvasCourses.length === 0) {
        fetchCanvasGrades();
      }
    } else if (tab === 'skyward' && skywardConnected) {
      if (skywardCourses.length === 0) {
        fetchSkywardGrades();
      }
    }
  };

  const openCalculator = (course: SkywardCourse) => {
    setSelectedSkywardCourse(course);
    // Initialize hypothetical grades with current grades
    const initial: Record<string, string> = {};
    course.grades.forEach(g => {
      if (g.letter) {
        initial[g.quarter] = g.letter;
      }
    });
    setHypotheticalGrades(initial);
    setCalculatorOpen(true);
  };

  const calculateHypotheticalGPA = (): string => {
    if (!selectedSkywardCourse) return 'N/A';

    // Replace the selected course's grades with hypothetical ones
    const modifiedCourses = skywardCourses.map(c => {
      if (c.name === selectedSkywardCourse.name && c.period === selectedSkywardCourse.period) {
        return {
          ...c,
          grades: c.grades.map(g => ({
            ...g,
            letter: hypotheticalGrades[g.quarter] || g.letter
          }))
        };
      }
      return c;
    });

    return calculateGPA(modifiedCourses);
  };

  // Calculate GPA for Skyward courses
  const skywardGPA = calculateGPA(skywardCourses);

  // Calculate GPA for Canvas courses
  const calculateCanvasGPA = (): string => {
    const validCourses = canvasCourses.filter(c => c.currentGrade);
    if (validCourses.length === 0) return 'N/A';

    let totalPoints = 0;
    let count = 0;

    validCourses.forEach(course => {
      if (course.currentGrade) {
        const grade = course.currentGrade.charAt(0).toUpperCase();
        const modifier = course.currentGrade.charAt(1);
        let basePoints = gradePoints[grade] || 0;

        // Handle +/- modifiers
        if (modifier === '+' && grade !== 'A') basePoints += 0.3;
        if (modifier === '-') basePoints -= 0.3;

        totalPoints += Math.max(0, basePoints);
        count++;
      }
    });

    return count > 0 ? (totalPoints / count).toFixed(2) : 'N/A';
  };

  const canvasGPA = calculateCanvasGPA();

  const currentGPA = activeTab === 'canvas' ? canvasGPA : skywardGPA;
  const isConnected = activeTab === 'canvas' ? canvasConnected : skywardConnected;

  const handleRefresh = () => {
    if (activeTab === 'canvas' && canvasConnected) {
      fetchCanvasGrades();
    } else if (activeTab === 'skyward' && skywardConnected) {
      fetchSkywardGrades();
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
                Grades
              </h1>
              {activeTab === 'skyward' && studentName && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {studentName} {school && `- ${school}`}
                </p>
              )}
              {activeTab === 'canvas' && canvasCourses.length > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {canvasCourses.length} courses from Canvas
                </p>
              )}
              {!isConnected && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Connect an account to view grades
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              {isConnected && (
                <div className="text-right">
                  <p className="text-sm text-gray-500">Current GPA</p>
                  <p className="text-2xl font-bold text-indigo-600">{currentGPA}</p>
                </div>
              )}
              <button
                onClick={handleRefresh}
                disabled={loading || !isConnected}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Source Tabs */}
        {(canvasConnected || skywardConnected) && (
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => handleTabChange('canvas')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'canvas'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              } ${!canvasConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!canvasConnected}
            >
              Canvas Grades {canvasConnected && '✓'}
            </button>
            <button
              onClick={() => handleTabChange('skyward')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'skyward'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              } ${!skywardConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!skywardConnected}
            >
              Skyward Grades {skywardConnected && '✓'}
            </button>
          </div>
        )}

        {!canvasConnected && !skywardConnected ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📊</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Connect to View Grades
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Link your Canvas or Skyward account to see your grades and GPA.
            </p>
            <Link
              href="/setup"
              className="inline-block px-6 py-3 rounded-lg font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              Connect Accounts
            </Link>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading grades from Skyward...</p>
              <p className="text-sm text-gray-400 mt-2">This may take a moment</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-800 font-medium mb-2">Error loading grades</p>
            <p className="text-red-600 text-sm mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : activeTab === 'canvas' ? (
          /* Canvas Grades View */
          <div className="space-y-6">
            {/* Canvas Class Grades */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Canvas Course Grades
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Current grades from your Canvas courses
                </p>
              </div>

              {canvasCourses.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No courses found in Canvas.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Course</th>
                        <th className="text-center px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 w-24">Score</th>
                        <th className="text-center px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {canvasCourses.map((course) => (
                        <tr key={course.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900 dark:text-white">{course.name}</p>
                            <p className="text-xs text-gray-500">{course.code}</p>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {course.currentScore !== null ? `${course.currentScore.toFixed(1)}%` : 'N/A'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-block px-3 py-1 rounded text-sm font-semibold ${getGradeColor(course.currentGrade)}`}>
                              {course.currentGrade || 'N/A'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Grade Scale Legend */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm text-gray-500 mb-2">Grade Scale</p>
              <div className="flex flex-wrap gap-2">
                {['A', 'B', 'C', 'D', 'F'].map(grade => (
                  <span key={grade} className={`px-3 py-1 rounded text-sm font-medium ${getGradeColor(grade)}`}>
                    {grade}: {grade === 'A' ? '90-100%' : grade === 'B' ? '80-89%' : grade === 'C' ? '70-79%' : grade === 'D' ? '60-69%' : 'Below 60%'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Skyward Grades View */
          <div className="space-y-6">
            {/* Missing Assignments Alert */}
            {missingAssignments.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
                <div className="bg-red-100 px-4 py-3 border-b border-red-200">
                  <h2 className="font-semibold text-red-800 flex items-center gap-2">
                    <span>⚠️</span>
                    Missing Assignments ({missingAssignments.length})
                  </h2>
                </div>
                <div className="p-4 space-y-3">
                  {missingAssignments.map((assignment, index) => (
                    <div key={index} className="flex items-start justify-between bg-white rounded-lg p-3 border border-red-100">
                      <div>
                        <p className="font-medium text-gray-900">{assignment.name}</p>
                        <p className="text-sm text-gray-600">{assignment.course}</p>
                        <p className="text-xs text-gray-500">{assignment.teacher}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-red-600">Due: {assignment.dueDate}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skyward Class Grades */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Skyward Class Grades
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Current quarter grades are highlighted. Click Calculator to see how grade changes affect your GPA.
                </p>
              </div>

              {skywardCourses.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No grades found. Skyward grades may not be loading due to security restrictions.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Class</th>
                        <th className="text-center px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 w-16">Q1</th>
                        <th className="text-center px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 w-16">Q2</th>
                        <th className="text-center px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 w-16">Q3</th>
                        <th className="text-center px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 w-16">Q4</th>
                        <th className="text-center px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {skywardCourses.map((course, index) => (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900 dark:text-white">{course.name}</p>
                            {course.period && (
                              <p className="text-xs text-gray-500">{course.period}</p>
                            )}
                            {course.teacher && (
                              <p className="text-xs text-gray-400">{course.teacher}</p>
                            )}
                          </td>
                          {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter) => {
                            const grade = course.grades.find(g => g.quarter === quarter);
                            return (
                              <td key={quarter} className="px-3 py-3 text-center">
                                <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${
                                  grade?.isCurrent ? 'ring-2 ring-indigo-400 ring-offset-1' : ''
                                } ${getGradeColor(grade?.letter || null)}`}>
                                  {grade?.letter || 'N/A'}
                                </span>
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-center">
                            <button
                              onClick={() => openCalculator(course)}
                              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                            >
                              Calculator
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm text-gray-500 mb-2">Grade Scale</p>
              <div className="flex flex-wrap gap-2">
                {['A', 'B', 'C', 'D', 'F'].map(grade => (
                  <span key={grade} className={`px-3 py-1 rounded text-sm font-medium ${getGradeColor(grade)}`}>
                    {grade}: {grade === 'A' ? '90-100%' : grade === 'B' ? '80-89%' : grade === 'C' ? '70-79%' : grade === 'D' ? '60-69%' : 'Below 60%'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Grade Calculator Modal */}
      {calculatorOpen && selectedSkywardCourse && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setCalculatorOpen(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <button
                onClick={() => setCalculatorOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Grade Calculator
              </h3>
              <p className="text-sm text-gray-500 mb-4">{selectedSkywardCourse.name}</p>

              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Adjust quarter grades to see how it affects your GPA:
                </p>

                <div className="grid grid-cols-4 gap-3">
                  {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter) => {
                    const currentGrade = selectedSkywardCourse.grades.find(g => g.quarter === quarter);
                    return (
                      <div key={quarter}>
                        <label className="block text-xs text-gray-500 mb-1">{quarter}</label>
                        <select
                          value={hypotheticalGrades[quarter] || currentGrade?.letter || ''}
                          onChange={(e) => setHypotheticalGrades(prev => ({
                            ...prev,
                            [quarter]: e.target.value
                          }))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">—</option>
                          {['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'].map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 mt-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Current GPA</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{currentGPA}</p>
                    </div>
                    <div className="text-2xl">→</div>
                    <div>
                      <p className="text-sm text-indigo-600 dark:text-indigo-400">Projected GPA</p>
                      <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                        {calculateHypotheticalGPA()}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-400 text-center">
                  This is an estimate. Actual GPA calculation may vary.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

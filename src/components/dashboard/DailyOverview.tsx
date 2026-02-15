'use client';

import { useState, useEffect, useCallback } from 'react';

interface Assignment {
  title: string;
  course: string;
  dueDate: Date;
  type: string;
  priority: string;
}

interface DailyOverviewProps {
  assignments: Assignment[];
  connected: boolean;
}

export default function DailyOverview({ assignments, connected }: DailyOverviewProps) {
  const [overview, setOverview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const fetchOverview = useCallback(async () => {
    const cacheKey = `daily-overview-${new Date().toDateString()}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setOverview(cached);
      return;
    }

    setLoading(true);
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
        setOverview(data.overview);
        localStorage.setItem(cacheKey, data.overview);
      }
    } catch (err) {
      console.error('Error fetching overview:', err);
    } finally {
      setLoading(false);
    }
  }, [assignments]);

  useEffect(() => {
    if (assignments.length > 0 && connected) {
      fetchOverview();
    }
  }, [assignments, connected, fetchOverview]);

  // Calculate today's stats
  const today = new Date();
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  const dueToday = assignments.filter(a => {
    const due = new Date(a.dueDate);
    return due <= todayEnd && due >= today;
  });

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const dueTomorrow = assignments.filter(a => {
    const due = new Date(a.dueDate);
    return due > todayEnd && due <= tomorrowEnd;
  });

  const urgentCount = assignments.filter(a => a.priority === 'high').length;

  if (!connected) {
    return (
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="text-2xl">&#x2728;</span>
            Daily Overview
          </h2>
        </div>
        <p className="text-indigo-100">
          Connect your Canvas account to see your personalized daily overview and AI-powered insights.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="text-2xl">&#x2728;</span>
          Daily Overview
        </h2>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-white/80 hover:text-white transition-colors"
        >
          {expanded ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>
      </div>

      {expanded && (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{dueToday.length}</p>
              <p className="text-xs text-indigo-100">Due Today</p>
            </div>
            <div className="bg-white/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{dueTomorrow.length}</p>
              <p className="text-xs text-indigo-100">Due Tomorrow</p>
            </div>
            <div className="bg-white/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{urgentCount}</p>
              <p className="text-xs text-indigo-100">Urgent</p>
            </div>
          </div>

          {/* AI Overview */}
          {loading ? (
            <div className="bg-white/10 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-white/20 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-white/20 rounded w-1/2"></div>
            </div>
          ) : overview ? (
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-indigo-100 text-sm leading-relaxed">{overview}</p>
            </div>
          ) : (
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-indigo-100 text-sm">
                {assignments.length === 0
                  ? "You're all caught up! No assignments due soon."
                  : `You have ${assignments.length} assignment${assignments.length === 1 ? '' : 's'} coming up. Focus on the urgent ones first!`}
              </p>
            </div>
          )}

          {/* Today's Focus */}
          {dueToday.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-indigo-200 uppercase tracking-wide mb-2">
                Focus for Today
              </p>
              <div className="space-y-2">
                {dueToday.slice(0, 3).map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                    <span className="text-white/90">{a.title}</span>
                    <span className="text-indigo-200 text-xs">({a.course})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

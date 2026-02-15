import { NextRequest, NextResponse } from 'next/server';
import { getCanvasCredentials } from '@/lib/auth/credentials';

const CANVAS_BASE_URL = 'https://canyons.instructure.com';

interface CanvasCourse {
  id: number;
  name: string;
}

interface CanvasAssignment {
  id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  lock_at: string | null;
  points_possible: number;
  course_id: number;
  submission_types: string[];
  has_submitted_submissions: boolean;
}

interface CanvasSubmission {
  id: number;
  submitted_at: string | null;
  late: boolean;
  missing: boolean;
  workflow_state: string;
  score: number | null;
  grade: string | null;
}

interface AssignmentWithSubmission extends CanvasAssignment {
  courseName: string;
  submission?: {
    submitted: boolean;
    late: boolean;
    missing: boolean;
    score: number | null;
    grade: string | null;
  };
}

export async function GET(request: NextRequest) {
  try {
    // Get token from database (authenticated user) or header (for testing)
    const credentials = await getCanvasCredentials();
    const token = credentials?.token || request.headers.get('x-canvas-token');
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '14');

    if (!token) {
      return NextResponse.json(
        { error: 'Canvas not connected. Please connect Canvas in settings.' },
        { status: 401 }
      );
    }

    // First, get all courses
    const coursesResponse = await fetch(
      `${CANVAS_BASE_URL}/api/v1/courses?enrollment_state=active&per_page=50`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!coursesResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch courses: ${coursesResponse.status}` },
        { status: coursesResponse.status }
      );
    }

    const courses: CanvasCourse[] = await coursesResponse.json();

    // Fetch assignments for each course in parallel
    const assignmentPromises = courses.map(async (course) => {
      try {
        const response = await fetch(
          `${CANVAS_BASE_URL}/api/v1/courses/${course.id}/assignments?per_page=100&order_by=due_at`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) return [];

        const assignments: CanvasAssignment[] = await response.json();
        return assignments.map((a) => ({
          ...a,
          courseName: course.name,
        }));
      } catch {
        return [];
      }
    });

    const assignmentArrays = await Promise.all(assignmentPromises);
    const allAssignments = assignmentArrays.flat();

    // Filter to upcoming assignments
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const upcomingAssignments = allAssignments
      .filter((assignment) => {
        if (!assignment.due_at) return false;
        const dueDate = new Date(assignment.due_at);
        return dueDate >= now && dueDate <= futureDate;
      })
      .sort((a, b) => {
        const dateA = new Date(a.due_at!).getTime();
        const dateB = new Date(b.due_at!).getTime();
        return dateA - dateB;
      });

    // Fetch submission status for each assignment
    const assignmentsWithSubmissions: AssignmentWithSubmission[] = await Promise.all(
      upcomingAssignments.map(async (assignment) => {
        try {
          const submissionResponse = await fetch(
            `${CANVAS_BASE_URL}/api/v1/courses/${assignment.course_id}/assignments/${assignment.id}/submissions/self`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (submissionResponse.ok) {
            const submission: CanvasSubmission = await submissionResponse.json();
            return {
              ...assignment,
              submission: {
                submitted: submission.submitted_at !== null || submission.workflow_state === 'submitted',
                late: submission.late,
                missing: submission.missing,
                score: submission.score,
                grade: submission.grade,
              },
            };
          }
        } catch {
          // Ignore submission fetch errors
        }
        return assignment as AssignmentWithSubmission;
      })
    );

    return NextResponse.json({
      assignments: assignmentsWithSubmissions,
      totalCourses: courses.length,
      totalUpcoming: assignmentsWithSubmissions.length,
    });
  } catch (error) {
    console.error('Assignments fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getCanvasCredentials } from '@/lib/auth/credentials';

const CANVAS_BASE_URL = 'https://canyons.instructure.com';

interface CanvasEnrollment {
  type: string;
  computed_current_score: number | null;
  computed_current_grade: string | null;
  computed_final_score: number | null;
  computed_final_grade: string | null;
}

interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollments?: CanvasEnrollment[];
}

export async function GET(request: NextRequest) {
  try {
    // Get token from database (authenticated user) or header (for testing)
    const credentials = await getCanvasCredentials();
    const token = credentials?.token || request.headers.get('x-canvas-token');

    if (!token) {
      return NextResponse.json(
        { error: 'Canvas not connected. Please connect Canvas in settings.' },
        { status: 401 }
      );
    }

    // Include total_scores to get grade information
    const response = await fetch(
      `${CANVAS_BASE_URL}/api/v1/courses?enrollment_state=active&include[]=total_scores&per_page=50`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Canvas API error: ${response.status}` },
        { status: response.status }
      );
    }

    const rawCourses: CanvasCourse[] = await response.json();

    // Transform to include grade info in a cleaner format
    const courses = rawCourses.map((course) => {
      const enrollment = course.enrollments?.[0];
      return {
        id: course.id,
        name: course.name,
        code: course.course_code,
        currentScore: enrollment?.computed_current_score ?? null,
        currentGrade: enrollment?.computed_current_grade ?? null,
        finalScore: enrollment?.computed_final_score ?? null,
        finalGrade: enrollment?.computed_final_grade ?? null,
      };
    });

    return NextResponse.json({
      courses,
      total: courses.length,
    });
  } catch (error) {
    console.error('Courses fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courses' },
      { status: 500 }
    );
  }
}

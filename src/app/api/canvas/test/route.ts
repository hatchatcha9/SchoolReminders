import { NextRequest, NextResponse } from 'next/server';

const CANVAS_BASE_URL = 'https://canyons.instructure.com';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Test the token by fetching courses
    const response = await fetch(`${CANVAS_BASE_URL}/api/v1/courses?enrollment_state=active&per_page=50`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Invalid token. Please check your access token and try again.' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: `Canvas API error: ${response.status}` },
        { status: response.status }
      );
    }

    const courses = await response.json();

    return NextResponse.json({
      success: true,
      courseCount: courses.length,
      courses: courses.map((c: { id: number; name: string; course_code: string }) => ({
        id: c.id,
        name: c.name,
        code: c.course_code,
      })),
    });
  } catch (error) {
    console.error('Canvas test error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to Canvas' },
      { status: 500 }
    );
  }
}

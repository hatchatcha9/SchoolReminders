import { NextRequest, NextResponse } from 'next/server';
import { getSkywardClient } from '@/lib/skyward/puppeteer-client';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const client = getSkywardClient();
    const result = await client.scrapeGrades(username, password);

    if (result.success) {
      return NextResponse.json({
        success: true,
        courses: result.courses || [],
        missingAssignments: result.missingAssignments || [],
        studentName: result.studentName || '',
        school: result.school || '',
        courseCount: result.courses?.length || 0
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch grades from Skyward' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Skyward grades error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch grades from Skyward' },
      { status: 500 }
    );
  }
}

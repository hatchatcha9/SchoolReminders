import { NextResponse } from 'next/server';
import { getSkywardClient } from '@/lib/skyward/puppeteer-client';
import { getSkywardCredentials } from '@/lib/auth/credentials';

export async function POST() {
  try {
    // Get credentials from database
    const credentials = await getSkywardCredentials();

    if (!credentials) {
      return NextResponse.json(
        { error: 'Skyward not connected. Please connect Skyward in settings.' },
        { status: 401 }
      );
    }

    const { username, password } = credentials;

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

import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { getUserCredentials } from '@/lib/db';

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get user's connected services
    const credentials = getUserCredentials(session.user.id);
    const connectedServices = credentials.map(c => c.service);

    return NextResponse.json({
      user: session.user,
      session: {
        expires_at: session.session.expires_at,
      },
      connectedServices,
    });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching session' },
      { status: 500 }
    );
  }
}

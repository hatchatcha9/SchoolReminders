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
    const result = await client.testConnection(username, password);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message || 'Connected successfully!'
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to connect to Skyward' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Skyward test error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to Skyward. Please check your credentials.' },
      { status: 500 }
    );
  }
}

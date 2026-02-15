import { NextRequest, NextResponse } from 'next/server';

// This endpoint provides sync status and can trigger refreshes
// Note: Actual sync happens client-side to access localStorage

export async function GET(_request: NextRequest) {
  return NextResponse.json({
    message: 'Sync status is managed client-side',
    instructions: 'Use the syncService from @/lib/sync on the client',
  });
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    switch (action) {
      case 'status':
        return NextResponse.json({
          success: true,
          message: 'Check client-side syncService.getStatus()',
        });

      case 'clear-cache':
        return NextResponse.json({
          success: true,
          message: 'Cache cleared on client-side',
        });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Sync API error:', error);
    return NextResponse.json(
      { error: 'Sync operation failed' },
      { status: 500 }
    );
  }
}

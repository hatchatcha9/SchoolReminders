import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { saveCredential, getCredential, deleteCredential } from '@/lib/db';
import { encryptCredentials, decryptCredentials } from '@/lib/auth/encryption';

// Save credentials for a service
export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { service, credentials } = body;

    if (!service || !credentials) {
      return NextResponse.json(
        { error: 'Service and credentials are required' },
        { status: 400 }
      );
    }

    if (service !== 'canvas' && service !== 'skyward') {
      return NextResponse.json(
        { error: 'Invalid service. Must be "canvas" or "skyward"' },
        { status: 400 }
      );
    }

    // Encrypt credentials
    const encrypted = encryptCredentials(credentials);

    // Save to database
    saveCredential(
      session.user.id,
      service,
      encrypted.encryptedData,
      encrypted.iv,
      encrypted.authTag
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save credentials error:', error);
    return NextResponse.json(
      { error: 'An error occurred while saving credentials' },
      { status: 500 }
    );
  }
}

// Get decrypted credentials for a service
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const service = request.nextUrl.searchParams.get('service');

    if (!service) {
      return NextResponse.json(
        { error: 'Service parameter is required' },
        { status: 400 }
      );
    }

    if (service !== 'canvas' && service !== 'skyward') {
      return NextResponse.json(
        { error: 'Invalid service. Must be "canvas" or "skyward"' },
        { status: 400 }
      );
    }

    const credential = getCredential(session.user.id, service);

    if (!credential) {
      return NextResponse.json(
        { error: 'No credentials found for this service' },
        { status: 404 }
      );
    }

    // Decrypt credentials
    const decrypted = decryptCredentials(
      credential.encrypted_data,
      credential.iv,
      credential.auth_tag
    );

    return NextResponse.json({ credentials: decrypted });
  } catch (error) {
    console.error('Get credentials error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching credentials' },
      { status: 500 }
    );
  }
}

// Delete credentials for a service
export async function DELETE(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const service = request.nextUrl.searchParams.get('service');

    if (!service) {
      return NextResponse.json(
        { error: 'Service parameter is required' },
        { status: 400 }
      );
    }

    if (service !== 'canvas' && service !== 'skyward') {
      return NextResponse.json(
        { error: 'Invalid service. Must be "canvas" or "skyward"' },
        { status: 400 }
      );
    }

    deleteCredential(session.user.id, service);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete credentials error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting credentials' },
      { status: 500 }
    );
  }
}

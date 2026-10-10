import { NextResponse } from 'next/server';
import {
  getAuthenticatedUser,
  findProfileById,
  createSignedSessionToken,
  attachSessionCookie,
  removeSessionCookie,
} from '@/lib/auth/server';
import { DEMO_PATIENTS, DEMO_DOCTORS } from '@/lib/mock-data';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      {
        authenticated: false,
        error: 'UNAUTHORIZED',
        message: 'No active authenticated session. Please sign in.',
      },
      { status: 401 }
    );
  }

  const allUsers = [...DEMO_PATIENTS, ...DEMO_DOCTORS];

  return NextResponse.json({
    authenticated: true,
    user,
    availableUsers: allUsers,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'User identifier is required to establish session.' },
        { status: 400 }
      );
    }

    const userProfile = findProfileById(userId);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `User identity '${userId}' not found.` },
        { status: 404 }
      );
    }

    // Generate cryptographically signed session token (HMAC-SHA256)
    const token = createSignedSessionToken(userProfile);

    const response = NextResponse.json({
      success: true,
      authenticated: true,
      user: userProfile,
      token,
      message: `Session securely established for ${userProfile.fullName} (${userProfile.role}).`,
    });

    // Attach HTTP-only cookie
    return attachSessionCookie(response, token);
  } catch {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to establish authenticated session.' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    authenticated: false,
    message: 'Session cleared.',
  });
  return removeSessionCookie(response);
}

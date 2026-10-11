import { NextResponse } from 'next/server';
import {
  getAuthenticatedUser,
  findProfileById,
  createSignedSessionToken,
  attachSessionCookie,
  removeSessionCookie,
  isDemoAuthAllowed,
  AuthError,
  AuthenticatedUser,
} from '@/lib/auth/server';
import { createServerAdminClient } from '@/lib/supabase/server';
import { DEMO_PATIENTS, DEMO_DOCTORS } from '@/lib/mock-data';
import { UserRole } from '@/types';

export async function GET(request: Request) {
  try {
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

    // Only expose synthetic personas if local demo authentication is enabled
    const demoActive = isDemoAuthAllowed();
    const availableUsers = demoActive ? [...DEMO_PATIENTS, ...DEMO_DOCTORS] : [];

    return NextResponse.json({
      authenticated: true,
      user,
      availableUsers,
      isDemoMode: demoActive,
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve session.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, accessToken } = body;

    // 1. Production authentication via verified Supabase Access Token
    if (accessToken) {
      const supabase = createServerAdminClient();
      const { data: { user: authUser }, error } = await supabase.auth.getUser(accessToken);
      if (error || !authUser) {
        return NextResponse.json(
          { error: 'UNAUTHORIZED', message: 'Invalid or expired authentication credentials.' },
          { status: 401 }
        );
      }

      const userProfile: AuthenticatedUser = {
        id: authUser.id,
        role: (authUser.user_metadata?.role as UserRole) || 'patient',
        fullName: authUser.user_metadata?.full_name || authUser.email || 'Verified User',
        email: authUser.email || '',
      };

      const token = createSignedSessionToken(userProfile);
      const response = NextResponse.json({
        success: true,
        authenticated: true,
        user: userProfile,
        token,
        message: `Session securely established for ${userProfile.fullName} (${userProfile.role}).`,
      });
      return attachSessionCookie(response, token);
    }

    // 2. Demo Persona Selector (userId submission)
    if (userId) {
      // Security Gate: Demo persona selection is strictly blocked in production / non-demo environments
      if (!isDemoAuthAllowed()) {
        return NextResponse.json(
          {
            error: 'FORBIDDEN',
            message: 'Demo persona selection is disabled in this environment. Arbitrary userId session establishment is prohibited. Authenticate using verified credentials.',
          },
          { status: 403 }
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

      const response = NextResponse.json(
        {
          success: true,
          authenticated: true,
          user: userProfile,
          token,
          isDemoSession: true,
          warning: 'DEMO PERSONA ACTIVE: Local persona selector only. Insecure for production use.',
          message: `Demo session established for ${userProfile.fullName} (${userProfile.role}).`,
        },
        {
          headers: {
            'X-MediVault-Demo-Auth': 'true',
          },
        }
      );

      // Attach HTTP-only cookie
      return attachSessionCookie(response, token);
    }

    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Credentials or persona identifier required to establish session.' },
      { status: 400 }
    );
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.statusCode }
      );
    }
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

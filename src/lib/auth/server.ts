import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createServerAdminClient } from '@/lib/supabase/server';
import { DEMO_PATIENTS, DEMO_DOCTORS } from '@/lib/mock-data';
import { UserProfile, UserRole } from '@/types';

export const SESSION_COOKIE_NAME = 'medivault_session_token';

// Server-side secret used for signing session tokens
// NEVER exposed to client-side code
const SERVER_SECRET =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SESSION_SECRET ||
  'medivault_zero_trust_server_secret_key_2026_production_grade';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  fullName: string;
  email: string;
  licenseNumber?: string;
  specialty?: string;
  organization?: string;
}

export class AuthError extends Error {
  statusCode: number;
  code: string;

  constructor(code: string, message: string, statusCode: number = 401) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Creates a cryptographically signed session token (HMAC-SHA256).
 */
export function createSignedSessionToken(user: AuthenticatedUser, expiresInSeconds: number = 86400): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: user.id,
    role: user.role,
    name: user.fullName,
    email: user.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', SERVER_SECRET)
    .update(signatureInput)
    .digest('base64url');

  return `${signatureInput}.${signature}`;
}

/**
 * Verifies a signed session token using constant-time HMAC comparison.
 */
export function verifySessionToken(token: string): { sub: string; role: UserRole; exp: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac('sha256', SERVER_SECRET)
      .update(signatureInput)
      .digest('base64url');

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length) return null;
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

    // Check expiration
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts session token from either:
 * 1. Authorization: Bearer <token> header
 * 2. HTTP cookie (medivault_session_token)
 */
export function extractTokenFromRequest(request: Request): string | null {
  // Check Authorization header
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  // Check Cookie header
  const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    for (const c of cookies) {
      if (c.startsWith(`${SESSION_COOKIE_NAME}=`)) {
        return decodeURIComponent(c.substring(SESSION_COOKIE_NAME.length + 1));
      }
    }
  }

  return null;
}

/**
 * Finds user profile by verified user ID.
 */
export function findProfileById(userId: string): AuthenticatedUser | null {
  const allUsers: UserProfile[] = [...DEMO_PATIENTS, ...DEMO_DOCTORS];
  const found = allUsers.find((u) => u.id === userId);
  if (!found) return null;

  return {
    id: found.id,
    role: found.role,
    fullName: found.fullName,
    email: found.email,
    licenseNumber: found.licenseNumber,
    specialty: found.specialty,
    organization: found.organization,
  };
}

/**
 * Server-only authentication resolver:
 * 1. Extracts token from Bearer header or HTTP cookie.
 * 2. Checks live Supabase Auth if a Supabase JWT is provided.
 * 3. Checks cryptographically signed session token.
 * 4. Strictly ignores any client-supplied x-viewer-id, patientId, or doctorId.
 */
export async function getAuthenticatedUser(request: Request): Promise<AuthenticatedUser | null> {
  const token = extractTokenFromRequest(request);
  if (!token) {
    return null;
  }

  // 1. First attempt: Verify as signed server session token
  const verifiedPayload = verifySessionToken(token);
  if (verifiedPayload) {
    const profile = findProfileById(verifiedPayload.sub);
    if (profile) return profile;
  }

  // 2. Second attempt: Check live Supabase Auth session
  try {
    const supabase = createServerAdminClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (user && !error) {
      // Fetch profile from database
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        return {
          id: profile.id,
          role: profile.role,
          fullName: profile.full_name,
          email: profile.email || user.email || '',
          licenseNumber: profile.license_number,
          specialty: profile.specialty,
          organization: profile.organization,
        };
      }

      // If user exists in auth but no profile row yet, construct from user metadata
      return {
        id: user.id,
        role: (user.user_metadata?.role as UserRole) || 'patient',
        fullName: user.user_metadata?.full_name || user.email || 'Verified User',
        email: user.email || '',
      };
    }
  } catch {
    // Supabase auth service unavailable or mock url
  }

  return null;
}

/**
 * Enforces that a request MUST be authenticated.
 * Returns the verified AuthenticatedUser or throws an AuthError (401).
 */
export async function requireAuth(request: Request): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    throw new AuthError('UNAUTHORIZED', 'Authentication required. Please sign in with a valid session.', 401);
  }
  return user;
}

/**
 * Enforces that a request MUST have a specific role (e.g. 'patient' or 'doctor').
 * Throws AuthError with 401 if unauthenticated, or 403 if unauthorized.
 */
export async function requireRole(request: Request, allowedRoles: UserRole | UserRole[]): Promise<AuthenticatedUser> {
  const user = await requireAuth(request);
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!roles.includes(user.role)) {
    throw new AuthError(
      'FORBIDDEN',
      `Access Denied (403): User role '${user.role}' is not authorized for this action (required: ${roles.join(', ')}).`,
      403
    );
  }

  return user;
}

/**
 * Helper to attach an HTTP-only session cookie to a NextResponse.
 */
export function attachSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 86400 * 7, // 7 days
  });
  return response;
}

/**
 * Helper to clear the session cookie on logout.
 */
export function removeSessionCookie(response: NextResponse): NextResponse {
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

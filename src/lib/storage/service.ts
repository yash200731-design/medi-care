import crypto from 'crypto';
import { createServerAdminClient } from '@/lib/supabase/server';
import { ConsentService } from '@/lib/dal/consent';
import { AuthenticatedUser } from '@/lib/auth/server';

const STORAGE_SECRET =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SESSION_SECRET ||
  'medivault_storage_secure_signing_secret_2026';

export const MEDICAL_RECORDS_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'medical-records';

export interface SignedUrlPayload {
  path: string;
  patientId: string;
  expires: number;
}

export class StorageService {
  /**
   * Generates a genuine short-lived signed URL for a private medical file.
   * Only called AFTER server-side authorization has confirmed active access.
   */
  static async createSignedUrl(
    storagePath: string,
    patientId: string,
    expiresInSeconds: number = 60
  ): Promise<string> {
    // 1. First attempt: If connected to live Supabase Storage, generate through SDK
    try {
      const supabase = createServerAdminClient();
      const { data, error } = await supabase.storage
        .from(MEDICAL_RECORDS_BUCKET)
        .createSignedUrl(storagePath, expiresInSeconds);

      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    } catch {
      // Supabase storage unavailable/mock
    }

    // 2. Cryptographic short-lived signed URL generation
    const expires = Date.now() + expiresInSeconds * 1000;
    const signatureInput = `${storagePath}:${patientId}:${expires}`;

    const sig = crypto
      .createHmac('sha256', STORAGE_SECRET)
      .update(signatureInput)
      .digest('base64url');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
      path: storagePath,
      patientId,
      expires: expires.toString(),
      sig,
    });

    return `${appUrl}/api/storage/download?${params.toString()}`;
  }

  /**
   * Verifies an incoming signed storage download request.
   * Strictly prevents cross-patient file access.
   */
  static async verifyAndAuthorizeDownload(
    searchParams: URLSearchParams,
    requestingUser: AuthenticatedUser
  ): Promise<{ authorized: boolean; statusCode: 200 | 400 | 401 | 403; error?: string; message: string; path?: string }> {
    const path = searchParams.get('path');
    const patientId = searchParams.get('patientId');
    const expiresStr = searchParams.get('expires');
    const sig = searchParams.get('sig');

    if (!path || !patientId || !expiresStr || !sig) {
      return {
        authorized: false,
        statusCode: 400,
        error: 'BAD_REQUEST',
        message: 'Missing signed storage URL parameters.',
      };
    }

    // 1. Expiration check
    const expires = parseInt(expiresStr, 10);
    if (isNaN(expires) || Date.now() > expires) {
      return {
        authorized: false,
        statusCode: 403,
        error: 'URL_EXPIRED',
        message: 'Signed download URL has expired. Please request a new authorized link.',
      };
    }

    // 2. Cryptographic HMAC signature check (constant-time)
    const expectedInput = `${path}:${patientId}:${expires}`;
    const expectedSig = crypto
      .createHmac('sha256', STORAGE_SECRET)
      .update(expectedInput)
      .digest('base64url');

    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return {
        authorized: false,
        statusCode: 403,
        error: 'INVALID_SIGNATURE',
        message: 'Tampered or invalid storage URL signature.',
      };
    }

    // 3. User boundary check:
    // If requesting user is a patient: they can ONLY access their own files!
    if (requestingUser.role === 'patient') {
      if (requestingUser.id !== patientId) {
        return {
          authorized: false,
          statusCode: 403,
          error: 'ACCESS_DENIED_CROSS_PATIENT',
          message: 'Access Denied (403): Patients are prohibited from accessing another patient\'s medical files.',
        };
      }
      return { authorized: true, statusCode: 200, message: 'Authorized patient owner download.', path };
    }

    // 4. If requesting user is a doctor: verify active consent grant in Supabase
    if (requestingUser.role === 'doctor') {
      const grants = await ConsentService.getGrants(patientId, requestingUser.id);
      const activeGrant = grants.find(
        (g) => !g.isRevoked && new Date(g.expiresAt).getTime() > Date.now()
      );

      if (!activeGrant) {
        return {
          authorized: false,
          statusCode: 403,
          error: 'ACCESS_DENIED_NO_ACTIVE_GRANT',
          message: 'Access Denied (403): No active consent grant authorizes this doctor to download this file.',
        };
      }

      return { authorized: true, statusCode: 200, message: 'Authorized doctor download.', path };
    }

    return {
      authorized: false,
      statusCode: 403,
      error: 'FORBIDDEN',
      message: 'Unauthorized role.',
    };
  }
}

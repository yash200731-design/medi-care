import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/server';
import { INITIAL_RECORDS, INITIAL_GRANTS } from '@/lib/mock-data';
import { ConsentGrant } from '@/types';

// In-memory grants cache for API verification
let activeGrants: ConsentGrant[] = [...INITIAL_GRANTS];

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Enforce server-only authenticated session
    // NEVER trust x-viewer-id, patientId, or doctorId supplied by the client
    const user = await requireAuth(request);

    const { id: recordId } = params;

    // 2. Find target medical record
    const record = INITIAL_RECORDS.find((r) => r.id === recordId);
    if (!record) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Medical record not found.' },
        { status: 404 }
      );
    }

    // 3. RULE: Patient Identity Verification
    if (user.role === 'patient') {
      if (user.id === record.patientId) {
        return NextResponse.json({
          authorized: true,
          reason: 'PATIENT_OWNER',
          record: {
            ...record,
            signedStorageUrl: `https://storage.medivault.local/download/${record.storagePath}?token=auth_${Date.now()}`,
          },
          message: 'Access granted: Requesting identity is the verified patient owner.',
        });
      } else {
        // Patient attempting to view another patient's record
        return NextResponse.json(
          {
            authorized: false,
            error: 'ACCESS_DENIED_UNAUTHORIZED',
            message: 'Access Denied (403): Patients are strictly prohibited from viewing medical files of other patients.',
          },
          { status: 403 }
        );
      }
    }

    // 4. RULE: Doctor Identity & Grant Verification
    if (user.role === 'doctor') {
      const doctorGrants = activeGrants.filter(
        (g) => g.patientId === record.patientId && g.doctorId === user.id
      );

      if (doctorGrants.length === 0) {
        return NextResponse.json(
          {
            authorized: false,
            error: 'ACCESS_DENIED_NO_GRANT',
            message: 'Access Denied (403): Doctor has no consent grant for this patient.',
            patientId: record.patientId,
            doctorId: user.id,
          },
          { status: 403 }
        );
      }

      // Check most recent grant
      const grant = doctorGrants[0];

      // Check Revocation
      if (grant.isRevoked) {
        return NextResponse.json(
          {
            authorized: false,
            error: 'ACCESS_DENIED_REVOKED',
            message: 'Access Denied (403): Patient has explicitly REVOKED consent for your credentials.',
            revokedAt: grant.revokedAt,
            blockchainTxHash: grant.blockchainTxHash,
          },
          { status: 403 }
        );
      }

      // Check Expiration
      const now = Date.now();
      const expiryTime = new Date(grant.expiresAt).getTime();

      if (now >= expiryTime) {
        return NextResponse.json(
          {
            authorized: false,
            error: 'ACCESS_DENIED_EXPIRED',
            message: `Access Denied (403): Consent grant EXPIRED at ${new Date(grant.expiresAt).toLocaleString()}. Access permanently closed.`,
            expiresAt: grant.expiresAt,
            blockchainTxHash: grant.blockchainTxHash,
          },
          { status: 403 }
        );
      }

      // Verified active consent grant
      const remainingMinutes = Math.round((expiryTime - now) / 60000);

      return NextResponse.json({
        authorized: true,
        reason: 'ACTIVE_GRANT',
        grant: {
          id: grant.id,
          expiresAt: grant.expiresAt,
          remainingMinutes,
          blockchainTxHash: grant.blockchainTxHash,
        },
        record: {
          ...record,
          signedStorageUrl: `https://storage.medivault.local/download/${record.storagePath}?token=grant_${grant.id}_${Date.now()}`,
        },
        message: `Access granted: Active consent verified. Window closes in ${remainingMinutes} minutes.`,
      });
    }

    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Unauthorized role for medical record access.' },
      { status: 403 }
    );
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Internal authorization error.' }, { status: 500 });
  }
}

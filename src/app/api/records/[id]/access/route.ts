import { NextResponse } from 'next/server';
import { INITIAL_RECORDS, INITIAL_GRANTS } from '@/lib/mock-data';
import { ConsentGrant } from '@/types';

// In-memory grants cache for API verification
let activeGrants: ConsentGrant[] = [...INITIAL_GRANTS];

function setApiGrants(grants: ConsentGrant[]) {
  activeGrants = grants;
}

function getApiGrants(): ConsentGrant[] {
  return activeGrants;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id: recordId } = params;
  const { searchParams } = new URL(request.url);

  // Viewer identity passed via header or query parameter
  const viewerId = request.headers.get('x-viewer-id') || searchParams.get('viewerId');

  if (!viewerId) {
    return NextResponse.json(
      {
        error: 'UNAUTHORIZED',
        message: 'Missing authenticated viewer identity (x-viewer-id header or viewerId parameter).',
      },
      { status: 401 }
    );
  }

  // Find target medical record
  const record = INITIAL_RECORDS.find((r) => r.id === recordId);
  if (!record) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Medical record not found.' }, { status: 404 });
  }

  // RULE 1: Patient viewing own record is always authorized
  if (viewerId === record.patientId) {
    return NextResponse.json({
      authorized: true,
      reason: 'PATIENT_OWNER',
      record: {
        ...record,
        signedStorageUrl: `https://storage.medivault.local/download/${record.storagePath}?token=auth_${Date.now()}`,
      },
      message: 'Access granted: Requesting identity is the verified patient owner.',
    });
  }

  // RULE 2: Doctor accessing patient record MUST satisfy active unrevoked unexpired grant
  const doctorGrants = activeGrants.filter(
    (g) => g.patientId === record.patientId && g.doctorId === viewerId
  );

  if (doctorGrants.length === 0) {
    return NextResponse.json(
      {
        authorized: false,
        error: 'ACCESS_DENIED_NO_GRANT',
        message: 'Access Denied (403): Doctor has no consent grant for this patient.',
        patientId: record.patientId,
        doctorId: viewerId,
      },
      { status: 403 }
    );
  }

  // Retrieve the relevant grant (check the most recent or active one)
  const grant = doctorGrants[0];

  // RULE 3: Revocation Check
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

  // RULE 4: Expiration Check
  const now = new Date().getTime();
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

  // SUCCESS: Active, non-expired, non-revoked grant verified!
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

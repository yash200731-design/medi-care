import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/server';
import { ConsentService } from '@/lib/dal/consent';
import { StorageService } from '@/lib/storage/service';
import { INITIAL_RECORDS } from '@/lib/mock-data';

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

    // 3. Delegate to ConsentService: Supabase as source of truth
    const accessCheck = await ConsentService.verifyFileAccess(user.id, user.role, record);

    if (!accessCheck.allowed) {
      return NextResponse.json(
        {
          authorized: false,
          error: accessCheck.error,
          message: accessCheck.message,
          patientId: record.patientId,
          doctorId: user.id,
          expiresAt: accessCheck.grant?.expiresAt,
          revokedAt: accessCheck.grant?.revokedAt,
          blockchainTxHash: accessCheck.grant?.blockchainTxHash,
        },
        { status: accessCheck.statusCode }
      );
    }

    // 4. Generate genuine short-lived signed storage URL (valid for 60 seconds)
    const signedStorageUrl = await StorageService.createSignedUrl(
      record.storagePath,
      record.patientId,
      60 // 60 seconds short-lived
    );

    const remainingMinutes = accessCheck.grant?.expiresAt
      ? Math.max(0, Math.round((new Date(accessCheck.grant.expiresAt).getTime() - Date.now()) / 60000))
      : undefined;

    return NextResponse.json({
      authorized: true,
      reason: accessCheck.reason,
      grant: accessCheck.grant
        ? {
            id: accessCheck.grant.id,
            expiresAt: accessCheck.grant.expiresAt,
            remainingMinutes,
            blockchainTxHash: accessCheck.grant.blockchainTxHash,
          }
        : undefined,
      record: {
        ...record,
        signedStorageUrl,
      },
      message: accessCheck.message,
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Internal authorization error.' }, { status: 500 });
  }
}

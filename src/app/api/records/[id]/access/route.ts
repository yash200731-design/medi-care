import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/server';
import { ConsentService } from '@/lib/dal/consent';
import { RecordsService } from '@/lib/dal/records';
import { AuditService } from '@/lib/dal/audit';
import { getPersistenceMetadata } from '@/lib/dal/persistence';
import { StorageService } from '@/lib/storage/service';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Enforce server-only authenticated session
    // NEVER trust x-viewer-id, patientId, or doctorId supplied by the client
    const user = await requireAuth(request);

    const { id: recordId } = params;

    // 2. Find target medical record via RecordsService
    const record = await RecordsService.getRecordById(recordId);
    if (!record) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Medical record not found.', persistence: getPersistenceMetadata() },
        { status: 404 }
      );
    }

    // 3. Delegate to ConsentService: Supabase as source of truth
    const accessCheck = await ConsentService.verifyFileAccess(user.id, user.role, record);

    if (!accessCheck.allowed) {
      await AuditService.logEvent({
        actorId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'ACCESS_DENIED_UNAUTHORIZED',
        targetPatientId: record.patientId,
        targetPatientName: record.patientName,
        targetDoctorId: user.id,
        targetDoctorName: user.fullName,
        targetRecordId: record.id,
        targetRecordTitle: record.title,
        details: {
          error: accessCheck.error,
          message: accessCheck.message,
        },
        confirmedOnChain: false,
        isSimulated: true,
      });

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
          persistence: getPersistenceMetadata(),
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

    await AuditService.logEvent({
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'ACCESS_RECORD',
      targetPatientId: record.patientId,
      targetPatientName: record.patientName,
      targetDoctorId: user.id,
      targetDoctorName: user.fullName,
      targetRecordId: record.id,
      targetRecordTitle: record.title,
      details: {
        reason: accessCheck.reason,
        grantId: accessCheck.grant?.id,
      },
      blockchainTxHash: accessCheck.grant?.blockchainTxHash,
      confirmedOnChain: false,
      isSimulated: true,
    });

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
      persistence: getPersistenceMetadata(),
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message, persistence: getPersistenceMetadata() }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Internal authorization error.', persistence: getPersistenceMetadata() }, { status: 500 });
  }
}

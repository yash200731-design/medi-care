import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth, AuthError } from '@/lib/auth/server';
import { RecordsService } from '@/lib/dal/records';
import { AuditService } from '@/lib/dal/audit';
import { getPersistenceMetadata } from '@/lib/dal/persistence';
import { BlockchainRelayer } from '@/lib/blockchain/relayer';
import { MedicalRecord } from '@/types';

export async function GET(request: Request) {
  try {
    // 1. Enforce server-side authentication
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const requestedPatientId = searchParams.get('patientId');

    // 2. Patient role authorization:
    if (user.role === 'patient') {
      if (requestedPatientId && requestedPatientId !== user.id) {
        return NextResponse.json(
          {
            error: 'FORBIDDEN',
            message: 'Access Denied (403): Patients are prohibited from viewing other patients\' medical vaults.',
          },
          { status: 403 }
        );
      }

      const patientRecords = await RecordsService.getRecordsForUser(
        user.id,
        user.role,
        requestedPatientId
      );
      return NextResponse.json({
        records: patientRecords,
        persistence: getPersistenceMetadata(),
      });
    }

    // 3. Doctor role authorization:
    if (user.role === 'doctor') {
      try {
        const records = await RecordsService.getRecordsForUser(
          user.id,
          user.role,
          requestedPatientId
        );
        return NextResponse.json({
          records,
          persistence: getPersistenceMetadata(),
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Access denied';
        if (msg.includes('FORBIDDEN') || msg.includes('lacks active consent grant')) {
          return NextResponse.json(
            {
              error: 'FORBIDDEN',
              message: 'Access Denied (403): Doctor does not possess an active, valid consent grant for this patient.',
            },
            { status: 403 }
          );
        }
        throw err;
      }
    }

    return NextResponse.json(
      {
        error: 'FORBIDDEN',
        message: `Access Denied (403): User role '${user.role}' is not authorized to query medical records.`,
      },
      { status: 403 }
    );
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.statusCode });
    }
    const errorMsg = err instanceof Error ? err.message : 'Failed to retrieve records.';
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: errorMsg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // 1. Enforce authentication
    const user = await requireAuth(request);

    // 2. Enforce patient role: doctors and unauthorized roles cannot upload to vaults
    if (user.role !== 'patient') {
      return NextResponse.json(
        {
          error: 'FORBIDDEN',
          message: 'Access Denied (403): Only patients have authority to upload medical records to their vault.',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, description, category, fileName, fileSize, content, contentPreview, patientId: clientSuppliedPatientId } = body;
    const rawContent = content || contentPreview;

    // 3. Detect and block impersonation attempt if client tried to specify another patient's ID
    if (clientSuppliedPatientId && clientSuppliedPatientId !== user.id) {
      return NextResponse.json(
        {
          error: 'FORBIDDEN',
          message: 'Access Denied (403): Impersonation attempt detected. You cannot upload records on behalf of another patient.',
        },
        { status: 403 }
      );
    }

    if (!title || !category || !rawContent) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'title, category, and content are required.' },
        { status: 400 }
      );
    }

    // Compute cryptographic SHA-256 hash server-side (or verify provided)
    const documentSha256 = body.documentSha256 || crypto.createHash('sha256').update(rawContent).digest('hex');

    // Anchor hash to blockchain relayer
    const onChainResult = await BlockchainRelayer.recordDocumentIntegrity(documentSha256, user.id);

    // Identity is strictly bound to authenticated user.id
    const newRecord: MedicalRecord = {
      id: `rec-${Date.now()}`,
      patientId: user.id,
      patientName: user.fullName,
      title,
      description: description || '',
      category,
      storagePath: `${user.id}/${Date.now()}-${fileName || 'document.pdf'}`,
      fileName: fileName || `${title.replace(/\s+/g, '_')}.pdf`,
      fileSize: fileSize || Buffer.byteLength(rawContent, 'utf8'),
      mimeType: 'application/pdf',
      documentSha256,
      blockchainTxHash: onChainResult.transactionHash || undefined,
      createdAt: new Date().toISOString(),
      contentPreview: rawContent,
    };

    // Save in authoritative RecordsService
    const savedRecord = await RecordsService.createRecord(newRecord);

    // Log server audit event
    await AuditService.logEvent({
      actorId: user.id,
      actorName: user.fullName,
      actorRole: 'patient',
      action: 'UPLOAD_RECORD',
      targetPatientId: user.id,
      targetPatientName: user.fullName,
      targetRecordId: savedRecord.id,
      targetRecordTitle: savedRecord.title,
      details: {
        sha256: documentSha256,
        category,
        fileName: savedRecord.fileName,
      },
      blockchainTxHash: onChainResult.transactionHash || undefined,
      confirmedOnChain: onChainResult.confirmed,
      isSimulated: onChainResult.isSimulated,
    });

    return NextResponse.json(
      {
        success: true,
        record: savedRecord,
        blockchain: onChainResult,
        persistence: getPersistenceMetadata(),
        message: 'Medical record encrypted and integrity SHA-256 anchored to blockchain ledger.',
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.statusCode });
    }
    const errorMsg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: errorMsg }, { status: 500 });
  }
}

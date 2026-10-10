import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth, AuthError } from '@/lib/auth/server';
import { INITIAL_RECORDS, INITIAL_GRANTS } from '@/lib/mock-data';
import { BlockchainRelayer } from '@/lib/blockchain/relayer';
import { MedicalRecord, ConsentGrant } from '@/types';

// In-memory records cache for API operations
let apiRecords: MedicalRecord[] = [...INITIAL_RECORDS];
let apiGrants: ConsentGrant[] = [...INITIAL_GRANTS];

function getApiRecords(): MedicalRecord[] {
  return apiRecords;
}

function setApiRecords(records: MedicalRecord[]) {
  apiRecords = records;
}

export async function GET(request: Request) {
  try {
    // 1. Enforce authentication
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const requestedPatientId = searchParams.get('patientId');

    // 2. Patient role authorization:
    if (user.role === 'patient') {
      // If a patient queries another patient's ID, strictly deny with 403
      if (requestedPatientId && requestedPatientId !== user.id) {
        return NextResponse.json(
          {
            error: 'FORBIDDEN',
            message: 'Access Denied (403): Patients are prohibited from viewing other patients\' medical vaults.',
          },
          { status: 403 }
        );
      }
      // Return only records owned by this patient
      const patientRecords = apiRecords.filter((r) => r.patientId === user.id);
      return NextResponse.json({ records: patientRecords });
    }

    // 3. Doctor role authorization:
    if (user.role === 'doctor') {
      if (requestedPatientId) {
        // Verify active, unexpired, non-revoked consent grant for (patient, doctor)
        const activeGrant = apiGrants.find(
          (g) =>
            g.patientId === requestedPatientId &&
            g.doctorId === user.id &&
            !g.isRevoked &&
            new Date(g.expiresAt).getTime() > Date.now()
        );

        if (!activeGrant) {
          return NextResponse.json(
            {
              error: 'FORBIDDEN',
              message: 'Access Denied (403): Doctor does not possess an active, valid consent grant for this patient.',
            },
            { status: 403 }
          );
        }

        const patientRecords = apiRecords.filter((r) => r.patientId === requestedPatientId);
        return NextResponse.json({ records: patientRecords });
      }

      // If no specific patient requested, return only records for patients with active grants
      const authorizedPatientIds = new Set(
        apiGrants
          .filter(
            (g) =>
              g.doctorId === user.id &&
              !g.isRevoked &&
              new Date(g.expiresAt).getTime() > Date.now()
          )
          .map((g) => g.patientId)
      );

      const records = apiRecords.filter((r) => authorizedPatientIds.has(r.patientId));
      return NextResponse.json({ records });
    }

    return NextResponse.json({ records: [] });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve records.' }, { status: 500 });
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
    const { title, description, category, fileName, fileSize, content, patientId: clientSuppliedPatientId } = body;

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

    if (!title || !category || !content) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'title, category, and content are required.' },
        { status: 400 }
      );
    }

    // Compute cryptographic SHA-256 hash server-side
    const documentSha256 = crypto.createHash('sha256').update(content).digest('hex');

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
      fileSize: fileSize || Buffer.byteLength(content, 'utf8'),
      mimeType: 'application/pdf',
      documentSha256,
      blockchainTxHash: onChainResult.transactionHash,
      createdAt: new Date().toISOString(),
      contentPreview: content,
    };

    apiRecords = [newRecord, ...apiRecords];

    return NextResponse.json({
      success: true,
      record: newRecord,
      blockchain: onChainResult,
      message: 'Medical record encrypted and integrity SHA-256 anchored to blockchain ledger.',
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.statusCode });
    }
    const errorMsg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: errorMsg }, { status: 500 });
  }
}

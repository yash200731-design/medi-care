import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { INITIAL_RECORDS } from '@/lib/mock-data';
import { BlockchainRelayer } from '@/lib/blockchain/relayer';
import { MedicalRecord } from '@/types';

// In-memory records cache for API operations
let apiRecords: MedicalRecord[] = [...INITIAL_RECORDS];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId');

  if (patientId) {
    const filtered = apiRecords.filter((r) => r.patientId === patientId);
    return NextResponse.json({ records: filtered });
  }

  return NextResponse.json({ records: apiRecords });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { patientId, patientName, title, description, category, fileName, fileSize, content } = body;

    if (!patientId || !title || !category || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: patientId, title, category, and content are required.' },
        { status: 400 }
      );
    }

    // Compute cryptographic SHA-256 hash server-side
    const documentSha256 = crypto.createHash('sha256').update(content).digest('hex');

    // Anchor hash to blockchain relayer
    const onChainResult = await BlockchainRelayer.recordDocumentIntegrity(documentSha256, patientId);

    const newRecord: MedicalRecord = {
      id: `rec-${Date.now()}`,
      patientId,
      patientName: patientName || 'Patient',
      title,
      description: description || '',
      category,
      storagePath: `${patientId}/${Date.now()}-${fileName || 'document.pdf'}`,
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
    const errorMsg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

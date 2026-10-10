import { NextResponse } from 'next/server';
import { INITIAL_AUDIT_EVENTS, INITIAL_RECORDS } from '@/lib/mock-data';
import { AuditEvent } from '@/types';

let apiAuditEvents: AuditEvent[] = [...INITIAL_AUDIT_EVENTS];

export async function GET() {
  return NextResponse.json({
    events: apiAuditEvents,
    totalCount: apiAuditEvents.length,
    blockchainStatus: {
      connected: true,
      network: 'Hardhat Local / Ethereum Testnet',
      latestBlock: 19846210,
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { documentSha256 } = body;

    if (!documentSha256) {
      return NextResponse.json({ error: 'documentSha256 is required' }, { status: 400 });
    }

    const cleanHash = documentSha256.toLowerCase().trim();
    const matchingRecord = INITIAL_RECORDS.find(
      (r) => r.documentSha256.toLowerCase() === cleanHash
    );

    if (matchingRecord) {
      return NextResponse.json({
        verified: true,
        documentSha256: cleanHash,
        title: matchingRecord.title,
        patientName: matchingRecord.patientName,
        anchoredAt: matchingRecord.createdAt,
        blockchainTxHash: matchingRecord.blockchainTxHash,
        status: 'AUTHENTIC & UNTAMPERED',
        message: 'Cryptographic SHA-256 hash verified against immutable blockchain state.',
      });
    }

    return NextResponse.json({
      verified: false,
      documentSha256: cleanHash,
      status: 'NOT_FOUND_OR_ALTERED',
      message: 'Hash not recognized on ledger or document may have been tampered with.',
    });
  } catch {
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

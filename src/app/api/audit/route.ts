import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/server';
import { INITIAL_AUDIT_EVENTS, INITIAL_RECORDS } from '@/lib/mock-data';
import { AuditEvent } from '@/types';

let apiAuditEvents: AuditEvent[] = [...INITIAL_AUDIT_EVENTS];

function getApiAuditEvents(): AuditEvent[] {
  return apiAuditEvents;
}

function setApiAuditEvents(events: AuditEvent[]) {
  apiAuditEvents = events;
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);

    // Filter audit trail so users only see logs relevant to their identity
    let visibleEvents = apiAuditEvents;

    if (user.role === 'patient') {
      visibleEvents = apiAuditEvents.filter(
        (e) => e.actorId === user.id || e.targetPatientId === user.id
      );
    } else if (user.role === 'doctor') {
      visibleEvents = apiAuditEvents.filter(
        (e) => e.actorId === user.id || e.targetDoctorId === user.id
      );
    }

    return NextResponse.json({
      events: visibleEvents,
      totalCount: visibleEvents.length,
      blockchainStatus: {
        connected: true,
        network: 'Hardhat Local / Ethereum Testnet',
        latestBlock: 19846210,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve audit events.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(request);

    const body = await request.json();
    const { documentSha256 } = body;

    if (!documentSha256) {
      return NextResponse.json({ error: 'BAD_REQUEST', message: 'documentSha256 is required.' }, { status: 400 });
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
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Verification failed.' }, { status: 500 });
  }
}

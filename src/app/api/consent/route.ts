import { NextResponse } from 'next/server';
import { INITIAL_GRANTS, DEMO_PATIENTS, DEMO_DOCTORS } from '@/lib/mock-data';
import { BlockchainRelayer } from '@/lib/blockchain/relayer';
import { ConsentGrant } from '@/types';

let apiGrants: ConsentGrant[] = [...INITIAL_GRANTS];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId');
  const doctorId = searchParams.get('doctorId');

  let results = apiGrants;
  if (patientId) {
    results = results.filter((g) => g.patientId === patientId);
  } else if (doctorId) {
    results = results.filter((g) => g.doctorId === doctorId);
  }

  return NextResponse.json({ grants: results });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { requestId, patientId, doctorId, durationHours } = body;

    if (!patientId || !doctorId || !durationHours) {
      return NextResponse.json(
        { error: 'patientId, doctorId, and durationHours are required.' },
        { status: 400 }
      );
    }

    const grantId = `grant-${Date.now()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + Number(durationHours) * 3600 * 1000);
    const expiresAtUnix = Math.floor(expiresAt.getTime() / 1000);

    // Call blockchain relayer
    const onChainResult = await BlockchainRelayer.recordConsentGrant(
      grantId,
      patientId,
      doctorId,
      expiresAtUnix
    );

    const patient = DEMO_PATIENTS.find((p) => p.id === patientId);
    const doctor = DEMO_DOCTORS.find((d) => d.id === doctorId);

    const newGrant: ConsentGrant = {
      id: grantId,
      requestId,
      patientId,
      patientName: patient?.fullName || 'Patient',
      doctorId,
      doctorName: doctor?.fullName || 'Physician',
      doctorSpecialty: doctor?.specialty,
      grantedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isRevoked: false,
      blockchainTxHash: onChainResult.transactionHash,
      createdAt: now.toISOString(),
    };

    apiGrants = [newGrant, ...apiGrants];

    return NextResponse.json({
      success: true,
      grant: newGrant,
      blockchain: onChainResult,
      message: `Consent grant successfully recorded and anchored on-chain with ${durationHours}-hour validity.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error granting consent';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const grantId = searchParams.get('grantId');

    if (!grantId) {
      return NextResponse.json({ error: 'grantId is required.' }, { status: 400 });
    }

    const targetGrant = apiGrants.find((g) => g.id === grantId);
    if (!targetGrant) {
      return NextResponse.json({ error: 'Grant not found.' }, { status: 404 });
    }

    // Call blockchain relayer for revocation
    const onChainResult = await BlockchainRelayer.recordConsentRevocation(
      grantId,
      targetGrant.patientId,
      targetGrant.doctorId
    );

    targetGrant.isRevoked = true;
    targetGrant.revokedAt = new Date().toISOString();
    targetGrant.blockchainTxHash = onChainResult.transactionHash;

    return NextResponse.json({
      success: true,
      grant: targetGrant,
      blockchain: onChainResult,
      message: 'Consent grant IMMEDIATELY revoked on ledger. All subsequent doctor requests will be denied with HTTP 403.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error revoking consent';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

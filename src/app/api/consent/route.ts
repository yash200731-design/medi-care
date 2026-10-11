import { NextResponse } from 'next/server';
import { requireAuth, requireRole, AuthError } from '@/lib/auth/server';
import { DEMO_DOCTORS } from '@/lib/mock-data';
import { BlockchainRelayer } from '@/lib/blockchain/relayer';
import { ConsentService } from '@/lib/dal/consent';
import { RequestsService } from '@/lib/dal/requests';
import { AuditService } from '@/lib/dal/audit';
import { getPersistenceMetadata } from '@/lib/dal/persistence';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const filterPatientId = searchParams.get('patientId');
    const filterDoctorId = searchParams.get('doctorId');

    // 1. Patient role: can ONLY view grants they issued
    if (user.role === 'patient') {
      if (filterPatientId && filterPatientId !== user.id) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'Patients can only inspect consent grants they issued.', persistence: getPersistenceMetadata() },
          { status: 403 }
        );
      }
      const results = await ConsentService.getAllGrantsForPatient(user.id);
      return NextResponse.json({ grants: results, persistence: getPersistenceMetadata() });
    }

    // 2. Doctor role: can ONLY view grants assigned to them
    if (user.role === 'doctor') {
      if (filterDoctorId && filterDoctorId !== user.id) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'Doctors can only inspect consent grants assigned to their identity.', persistence: getPersistenceMetadata() },
          { status: 403 }
        );
      }
      const results = await ConsentService.getAllGrantsForDoctor(user.id);
      return NextResponse.json({ grants: results, persistence: getPersistenceMetadata() });
    }

    return NextResponse.json(
      {
        error: 'FORBIDDEN',
        message: `Access Denied (403): User role '${user.role}' is not authorized to inspect consent grants.`,
        persistence: getPersistenceMetadata(),
      },
      { status: 403 }
    );
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message, persistence: getPersistenceMetadata() }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve consent grants.', persistence: getPersistenceMetadata() }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // 1. Enforce that ONLY patients can grant consent
    const user = await requireRole(request, 'patient');

    const body = await request.json();
    const { requestId, doctorId, durationHours, patientId: clientSuppliedPatientId } = body;

    // 2. Impersonation detection
    if (clientSuppliedPatientId && clientSuppliedPatientId !== user.id) {
      return NextResponse.json(
        {
          error: 'FORBIDDEN',
          message: 'Access Denied (403): Impersonation attempt detected. Cannot issue consent grants for another patient.',
          persistence: getPersistenceMetadata(),
        },
        { status: 403 }
      );
    }

    if (!doctorId || !durationHours) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'doctorId and durationHours are required.', persistence: getPersistenceMetadata() },
        { status: 400 }
      );
    }

    const grantId = `grant-${Date.now()}`;
    const expiresAtUnix = Math.floor(Date.now() / 1000) + Number(durationHours) * 3600;

    // Call blockchain relayer
    const onChainResult = await BlockchainRelayer.recordConsentGrant(
      grantId,
      user.id,
      doctorId,
      expiresAtUnix
    );

    const doctor = DEMO_DOCTORS.find((d) => d.id === doctorId);

    // Persist via ConsentService
    const newGrant = await ConsentService.createGrant({
      id: grantId,
      requestId,
      patientId: user.id,
      patientName: user.fullName,
      doctorId,
      doctorName: doctor?.fullName || 'Physician',
      doctorSpecialty: doctor?.specialty,
      durationHours,
      blockchainTxHash: onChainResult.transactionHash || undefined,
    });

    // Update access request if referenced
    if (requestId) {
      await RequestsService.updateRequestStatus(requestId, 'approved');
    }

    // Authoritative audit event
    await AuditService.logEvent({
      actorId: user.id,
      actorName: user.fullName,
      actorRole: 'patient',
      action: 'GRANT_ACCESS',
      targetPatientId: user.id,
      targetPatientName: user.fullName,
      targetDoctorId: doctorId,
      targetDoctorName: doctor?.fullName || 'Physician',
      details: {
        durationHours,
        grantId,
        requestId,
      },
      blockchainTxHash: onChainResult.transactionHash || undefined,
      confirmedOnChain: onChainResult.confirmed,
      isSimulated: onChainResult.isSimulated,
    });

    return NextResponse.json({
      success: true,
      grant: newGrant,
      blockchain: onChainResult,
      message: `Consent grant successfully recorded and anchored on-chain with ${durationHours}-hour validity.`,
      persistence: getPersistenceMetadata(),
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message, persistence: getPersistenceMetadata() }, { status: err.statusCode });
    }
    const msg = err instanceof Error ? err.message : 'Error granting consent';
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: msg, persistence: getPersistenceMetadata() }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    // 1. Enforce that ONLY patients can revoke consent
    const user = await requireRole(request, 'patient');

    const { searchParams } = new URL(request.url);
    const grantId = searchParams.get('grantId');

    if (!grantId) {
      return NextResponse.json({ error: 'BAD_REQUEST', message: 'grantId is required.', persistence: getPersistenceMetadata() }, { status: 400 });
    }

    const targetGrant = await ConsentService.getGrantById(grantId);

    if (!targetGrant) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Consent grant not found.', persistence: getPersistenceMetadata() }, { status: 404 });
    }

    // 2. Verify patient ownership of the grant
    if (targetGrant.patientId !== user.id) {
      return NextResponse.json(
        {
          error: 'FORBIDDEN',
          message: 'Access Denied (403): You cannot revoke a consent grant belonging to another patient.',
          persistence: getPersistenceMetadata(),
        },
        { status: 403 }
      );
    }

    // Call blockchain relayer for revocation
    const onChainResult = await BlockchainRelayer.recordConsentRevocation(
      grantId,
      targetGrant.patientId,
      targetGrant.doctorId
    );

    // Revoke via ConsentService
    const revokedGrant = await ConsentService.revokeGrant(grantId, user.id);
    if (revokedGrant) {
      revokedGrant.blockchainTxHash = onChainResult.transactionHash || undefined;
    }

    // Log audit event
    await AuditService.logEvent({
      actorId: user.id,
      actorName: user.fullName,
      actorRole: 'patient',
      action: 'REVOKE_ACCESS',
      targetPatientId: user.id,
      targetPatientName: user.fullName,
      targetDoctorId: targetGrant.doctorId,
      targetDoctorName: targetGrant.doctorName,
      details: {
        grantId,
      },
      blockchainTxHash: onChainResult.transactionHash || undefined,
      confirmedOnChain: onChainResult.confirmed,
      isSimulated: onChainResult.isSimulated,
    });

    return NextResponse.json({
      success: true,
      grant: revokedGrant,
      blockchain: onChainResult,
      message: 'Consent grant IMMEDIATELY revoked on ledger. All subsequent doctor requests will be denied with HTTP 403.',
      persistence: getPersistenceMetadata(),
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message, persistence: getPersistenceMetadata() }, { status: err.statusCode });
    }
    const msg = err instanceof Error ? err.message : 'Error revoking consent';
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: msg, persistence: getPersistenceMetadata() }, { status: 500 });
  }
}

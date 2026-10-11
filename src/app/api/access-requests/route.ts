import { NextResponse } from 'next/server';
import { requireAuth, requireRole, AuthError } from '@/lib/auth/server';
import { DEMO_PATIENTS } from '@/lib/mock-data';
import { RequestsService } from '@/lib/dal/requests';
import { AuditService } from '@/lib/dal/audit';
import { getPersistenceMetadata } from '@/lib/dal/persistence';
import { AccessRequest } from '@/types';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const filterPatientId = searchParams.get('patientId');
    const filterDoctorId = searchParams.get('doctorId');

    const results = await RequestsService.getRequestsForUser(
      user.id,
      user.role,
      filterPatientId,
      filterDoctorId
    );

    return NextResponse.json({
      requests: results,
      persistence: getPersistenceMetadata(),
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message, persistence: getPersistenceMetadata() }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : 'Failed to retrieve access requests.';
    if (message.startsWith('FORBIDDEN')) {
      return NextResponse.json({ error: 'FORBIDDEN', message, persistence: getPersistenceMetadata() }, { status: 403 });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR', message, persistence: getPersistenceMetadata() }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // 1. Enforce that only authenticated doctors can submit access requests
    const user = await requireRole(request, 'doctor');

    const body = await request.json();
    const { patientId, purpose, clinicalNotes, requestedDurationHours, doctorId: clientSuppliedDoctorId } = body;

    // 2. Impersonation detection
    if (clientSuppliedDoctorId && clientSuppliedDoctorId !== user.id) {
      return NextResponse.json(
        {
          error: 'FORBIDDEN',
          message: 'Access Denied (403): Impersonation attempt detected. Cannot request access using another doctor\'s identity.',
          persistence: getPersistenceMetadata(),
        },
        { status: 403 }
      );
    }

    if (!patientId || !purpose) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'patientId and purpose are required.', persistence: getPersistenceMetadata() },
        { status: 400 }
      );
    }

    const patient = DEMO_PATIENTS.find((p) => p.id === patientId);

    const newRequest: AccessRequest = {
      id: `req-${Date.now()}`,
      doctorId: user.id,
      doctorName: user.fullName,
      doctorSpecialty: user.specialty,
      doctorOrganization: user.organization,
      patientId,
      patientName: patient?.fullName || 'Patient',
      purpose,
      clinicalNotes: clinicalNotes || '',
      requestedDurationHours: Number(requestedDurationHours) || 24,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const savedRequest = await RequestsService.createRequest(newRequest);

    // Authoritative audit event
    await AuditService.logEvent({
      actorId: user.id,
      actorName: user.fullName,
      actorRole: 'doctor',
      action: 'REQUEST_ACCESS',
      targetPatientId: patientId,
      targetPatientName: patient?.fullName || 'Patient',
      targetDoctorId: user.id,
      targetDoctorName: user.fullName,
      details: {
        purpose,
        requestId: newRequest.id,
        durationHours: newRequest.requestedDurationHours,
      },
      confirmedOnChain: false,
      isSimulated: true,
    });

    return NextResponse.json({
      success: true,
      request: savedRequest,
      message: 'Access request securely dispatched to patient medical vault.',
      persistence: getPersistenceMetadata(),
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message, persistence: getPersistenceMetadata() }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Server error processing request.', persistence: getPersistenceMetadata() }, { status: 500 });
  }
}

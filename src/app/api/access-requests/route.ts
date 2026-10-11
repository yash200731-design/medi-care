import { NextResponse } from 'next/server';
import { requireAuth, requireRole, AuthError } from '@/lib/auth/server';
import { INITIAL_REQUESTS, DEMO_PATIENTS } from '@/lib/mock-data';
import { AccessRequest } from '@/types';

let apiRequests: AccessRequest[] = [...INITIAL_REQUESTS];

function getApiRequests(): AccessRequest[] {
  return apiRequests;
}

function setApiRequests(requests: AccessRequest[]) {
  apiRequests = requests;
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const filterPatientId = searchParams.get('patientId');
    const filterDoctorId = searchParams.get('doctorId');

    // 1. Patient role: can ONLY view requests directed to them
    if (user.role === 'patient') {
      if (filterPatientId && filterPatientId !== user.id) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'Patients can only inspect access requests directed to their identity.' },
          { status: 403 }
        );
      }
      const results = apiRequests.filter((r) => r.patientId === user.id);
      return NextResponse.json({ requests: results });
    }

    // 2. Doctor role: can ONLY view requests created by them
    if (user.role === 'doctor') {
      if (filterDoctorId && filterDoctorId !== user.id) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'Doctors can only inspect access requests created by their identity.' },
          { status: 403 }
        );
      }
      const results = apiRequests.filter((r) => r.doctorId === user.id);
      return NextResponse.json({ requests: results });
    }

    return NextResponse.json(
      {
        error: 'FORBIDDEN',
        message: `Access Denied (403): User role '${user.role}' is not authorized to inspect access requests.`,
      },
      { status: 403 }
    );
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve access requests.' }, { status: 500 });
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
        },
        { status: 403 }
      );
    }

    if (!patientId || !purpose) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'patientId and purpose are required.' },
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

    apiRequests = [newRequest, ...apiRequests];

    return NextResponse.json({
      success: true,
      request: newRequest,
      message: 'Access request securely dispatched to patient medical vault.',
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Server error processing request.' }, { status: 500 });
  }
}

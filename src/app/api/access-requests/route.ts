import { NextResponse } from 'next/server';
import { INITIAL_REQUESTS, DEMO_DOCTORS, DEMO_PATIENTS } from '@/lib/mock-data';
import { AccessRequest } from '@/types';

let apiRequests: AccessRequest[] = [...INITIAL_REQUESTS];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId');
  const doctorId = searchParams.get('doctorId');

  let results = apiRequests;
  if (patientId) {
    results = results.filter((r) => r.patientId === patientId);
  } else if (doctorId) {
    results = results.filter((r) => r.doctorId === doctorId);
  }

  return NextResponse.json({ requests: results });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { doctorId, patientId, purpose, clinicalNotes, requestedDurationHours } = body;

    if (!doctorId || !patientId || !purpose) {
      return NextResponse.json(
        { error: 'doctorId, patientId, and purpose are required.' },
        { status: 400 }
      );
    }

    const doctor = DEMO_DOCTORS.find((d) => d.id === doctorId);
    const patient = DEMO_PATIENTS.find((p) => p.id === patientId);

    const newRequest: AccessRequest = {
      id: `req-${Date.now()}`,
      doctorId,
      doctorName: doctor?.fullName || 'Physician',
      doctorSpecialty: doctor?.specialty,
      doctorOrganization: doctor?.organization,
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
  } catch {
    return NextResponse.json({ error: 'Server error processing request' }, { status: 500 });
  }
}

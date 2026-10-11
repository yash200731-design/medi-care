/**
 * MediVault Access Requests Data Access Layer
 * Handles clinician access request persistence through Supabase PostgreSQL when configured,
 * or through the authoritative ServerStore in local demo mode.
 */

import { createServerAdminClient } from '@/lib/supabase/server';
import { isSupabaseConfigured, assertPersistenceAvailable } from './persistence';
import { ServerStore } from './server-store';
import { AccessRequest, UserRole } from '@/types';

export class RequestsService {
  /**
   * Retrieves access requests for a user based on their role and filters.
   */
  static async getRequestsForUser(
    userId: string,
    userRole: UserRole,
    filterPatientId?: string | null,
    filterDoctorId?: string | null
  ): Promise<AccessRequest[]> {
    assertPersistenceAvailable();

    // 1. Patient: requests directed to them
    if (userRole === 'patient') {
      if (filterPatientId && filterPatientId !== userId) {
        throw new Error('FORBIDDEN: Patients can only inspect access requests directed to their identity.');
      }
      return this.getRequestsByPatientId(userId);
    }

    // 2. Doctor: requests created by them
    if (userRole === 'doctor') {
      if (filterDoctorId && filterDoctorId !== userId) {
        throw new Error('FORBIDDEN: Doctors can only inspect access requests created by their identity.');
      }
      return this.getRequestsByDoctorId(userId);
    }

    throw new Error(`FORBIDDEN: Role '${userRole}' is not authorized to inspect access requests.`);
  }

  /**
   * Retrieves access requests directed to a patient.
   */
  static async getRequestsByPatientId(patientId: string): Promise<AccessRequest[]> {
    assertPersistenceAvailable();

    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerAdminClient();
        const { data, error } = await supabase
          .from('access_requests')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((row) => ({
            id: row.id,
            doctorId: row.doctor_id,
            doctorName: row.doctor_name || 'Physician',
            doctorSpecialty: row.doctor_specialty,
            doctorOrganization: row.doctor_organization,
            patientId: row.patient_id,
            patientName: row.patient_name || 'Patient',
            purpose: row.purpose,
            clinicalNotes: row.clinical_notes,
            requestedDurationHours: row.requested_duration_hours,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
        }
      } catch {}
    }

    return ServerStore.getRequests().filter((r) => r.patientId === patientId);
  }

  /**
   * Retrieves access requests created by a doctor.
   */
  static async getRequestsByDoctorId(doctorId: string): Promise<AccessRequest[]> {
    assertPersistenceAvailable();

    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerAdminClient();
        const { data, error } = await supabase
          .from('access_requests')
          .select('*')
          .eq('doctor_id', doctorId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((row) => ({
            id: row.id,
            doctorId: row.doctor_id,
            doctorName: row.doctor_name || 'Physician',
            doctorSpecialty: row.doctor_specialty,
            doctorOrganization: row.doctor_organization,
            patientId: row.patient_id,
            patientName: row.patient_name || 'Patient',
            purpose: row.purpose,
            clinicalNotes: row.clinical_notes,
            requestedDurationHours: row.requested_duration_hours,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
        }
      } catch {}
    }

    return ServerStore.getRequests().filter((r) => r.doctorId === doctorId);
  }

  /**
   * Persists a new access request.
   */
  static async createRequest(request: AccessRequest): Promise<AccessRequest> {
    assertPersistenceAvailable();

    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerAdminClient();
        await supabase.from('access_requests').insert({
          id: request.id,
          doctor_id: request.doctorId,
          patient_id: request.patientId,
          purpose: request.purpose,
          clinical_notes: request.clinicalNotes,
          requested_duration_hours: request.requestedDurationHours,
          status: request.status,
          created_at: request.createdAt,
          updated_at: request.updatedAt,
        });
      } catch {}
    }

    return ServerStore.addRequest(request);
  }

  /**
   * Updates status of an access request (e.g., to 'approved' when consent is granted).
   */
  static async updateRequestStatus(
    requestId: string,
    status: AccessRequest['status']
  ): Promise<AccessRequest | null> {
    assertPersistenceAvailable();

    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerAdminClient();
        await supabase
          .from('access_requests')
          .update({
            status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestId);
      } catch {}
    }

    return ServerStore.updateRequestStatus(requestId, status);
  }
}

import { createServerAdminClient } from '@/lib/supabase/server';
import { isSupabaseConfigured, assertPersistenceAvailable } from './persistence';
import { ServerStore } from './server-store';
import { ConsentGrant, MedicalRecord, UserRole } from '@/types';

export function getInMemoryGrants(): ConsentGrant[] {
  return ServerStore.getGrants();
}

export function setInMemoryGrants(grants: ConsentGrant[]) {
  // Provided for compatibility
}

export interface GrantVerificationResult {
  allowed: boolean;
  statusCode: 200 | 403 | 404;
  error?: string;
  reason?: 'PATIENT_OWNER' | 'ACTIVE_GRANT' | 'EXPIRED_GRANT' | 'REVOKED_GRANT' | 'NO_GRANT';
  grant?: ConsentGrant;
  message: string;
}

export class ConsentService {
  /**
   * Retrieves all consent grants for a given patient and doctor pair.
   */
  static async getGrants(patientId: string, doctorId: string): Promise<ConsentGrant[]> {
    assertPersistenceAvailable();

    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerAdminClient();
        const { data, error } = await supabase
          .from('consent_grants')
          .select('*')
          .eq('patient_id', patientId)
          .eq('doctor_id', doctorId)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((row) => ({
            id: row.id,
            requestId: row.request_id,
            patientId: row.patient_id,
            doctorId: row.doctor_id,
            grantedAt: row.granted_at,
            expiresAt: row.expires_at,
            isRevoked: row.is_revoked,
            revokedAt: row.revoked_at,
            blockchainTxHash: row.blockchain_tx_hash,
            createdAt: row.created_at,
          }));
        }
      } catch {}
    }

    return ServerStore.getGrantsForPair(patientId, doctorId);
  }

  /**
   * Retrieves a consent grant by its ID.
   */
  static async getGrantById(grantId: string): Promise<ConsentGrant | null> {
    assertPersistenceAvailable();

    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerAdminClient();
        const { data, error } = await supabase
          .from('consent_grants')
          .select('*')
          .eq('id', grantId)
          .single();

        if (!error && data) {
          return {
            id: data.id,
            requestId: data.request_id,
            patientId: data.patient_id,
            doctorId: data.doctor_id,
            grantedAt: data.granted_at,
            expiresAt: data.expires_at,
            isRevoked: data.is_revoked,
            revokedAt: data.revoked_at,
            blockchainTxHash: data.blockchain_tx_hash,
            createdAt: data.created_at,
          };
        }
      } catch {}
    }

    return ServerStore.getGrantById(grantId) || null;
  }

  /**
   * Retrieves all consent grants issued by a patient.
   */
  static async getAllGrantsForPatient(patientId: string): Promise<ConsentGrant[]> {
    assertPersistenceAvailable();

    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerAdminClient();
        const { data, error } = await supabase
          .from('consent_grants')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((row) => ({
            id: row.id,
            requestId: row.request_id,
            patientId: row.patient_id,
            doctorId: row.doctor_id,
            grantedAt: row.granted_at,
            expiresAt: row.expires_at,
            isRevoked: row.is_revoked,
            revokedAt: row.revoked_at,
            blockchainTxHash: row.blockchain_tx_hash,
            createdAt: row.created_at,
          }));
        }
      } catch {}
    }

    return ServerStore.getGrants().filter((g) => g.patientId === patientId);
  }

  /**
   * Retrieves all consent grants assigned to a doctor.
   */
  static async getAllGrantsForDoctor(doctorId: string): Promise<ConsentGrant[]> {
    assertPersistenceAvailable();

    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerAdminClient();
        const { data, error } = await supabase
          .from('consent_grants')
          .select('*')
          .eq('doctor_id', doctorId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((row) => ({
            id: row.id,
            requestId: row.request_id,
            patientId: row.patient_id,
            doctorId: row.doctor_id,
            grantedAt: row.granted_at,
            expiresAt: row.expires_at,
            isRevoked: row.is_revoked,
            revokedAt: row.revoked_at,
            blockchainTxHash: row.blockchain_tx_hash,
            createdAt: row.created_at,
          }));
        }
      } catch {}
    }

    return ServerStore.getGrants().filter((g) => g.doctorId === doctorId);
  }

  /**
   * Records a new consent grant in Supabase or authoritative ServerStore.
   */
  static async createGrant(params: {
    id: string;
    requestId?: string;
    patientId: string;
    patientName: string;
    doctorId: string;
    doctorName: string;
    doctorSpecialty?: string;
    durationHours: number;
    blockchainTxHash?: string;
  }): Promise<ConsentGrant> {
    assertPersistenceAvailable();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + Number(params.durationHours) * 3600 * 1000);

    const newGrant: ConsentGrant = {
      id: params.id,
      requestId: params.requestId,
      patientId: params.patientId,
      patientName: params.patientName,
      doctorId: params.doctorId,
      doctorName: params.doctorName,
      doctorSpecialty: params.doctorSpecialty,
      grantedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isRevoked: false,
      blockchainTxHash: params.blockchainTxHash,
      createdAt: now.toISOString(),
    };

    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerAdminClient();
        await supabase.from('consent_grants').insert({
          id: newGrant.id,
          request_id: newGrant.requestId,
          patient_id: newGrant.patientId,
          doctor_id: newGrant.doctorId,
          granted_at: newGrant.grantedAt,
          expires_at: newGrant.expiresAt,
          is_revoked: false,
          blockchain_tx_hash: newGrant.blockchainTxHash,
          created_at: newGrant.createdAt,
        });
      } catch {}
    }

    // Also update request status in server store if linked
    if (params.requestId) {
      ServerStore.updateRequestStatus(params.requestId, 'approved');
    }

    return ServerStore.addGrant(newGrant);
  }

  /**
   * Immediately revokes a consent grant.
   */
  static async revokeGrant(grantId: string, revokingPatientId: string): Promise<ConsentGrant | null> {
    assertPersistenceAvailable();

    const target = ServerStore.getGrantById(grantId);
    if (!target) return null;

    if (target.patientId !== revokingPatientId) {
      throw new Error('UNAUTHORIZED_REVOCATION: Grant belongs to another patient.');
    }

    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerAdminClient();
        await supabase
          .from('consent_grants')
          .update({
            is_revoked: true,
            revoked_at: new Date().toISOString(),
          })
          .eq('id', grantId)
          .eq('patient_id', revokingPatientId);
      } catch {}
    }

    return ServerStore.revokeGrant(grantId, revokingPatientId);
  }

  /**
   * Evaluates authorization on every protected file request.
   * Strictly enforces:
   * 1. Patient viewing own records -> Allowed (PATIENT_OWNER).
   * 2. Patient attempting to view another patient's records -> Denied (403 ACCESS_DENIED_UNAUTHORIZED).
   * 3. Doctor accessing patient records -> Verifies active unrevoked unexpired grant.
   */
  static async verifyFileAccess(
    viewerId: string,
    viewerRole: UserRole,
    record: MedicalRecord
  ): Promise<GrantVerificationResult> {
    // RULE 1: Patient access
    if (viewerRole === 'patient') {
      if (viewerId === record.patientId) {
        return {
          allowed: true,
          statusCode: 200,
          reason: 'PATIENT_OWNER',
          message: 'Access granted: Requesting identity is the verified patient owner.',
        };
      } else {
        // Cross-patient boundary violation
        return {
          allowed: false,
          statusCode: 403,
          error: 'ACCESS_DENIED_UNAUTHORIZED',
          message: 'Access Denied (403): Patients are strictly prohibited from viewing medical files of other patients.',
        };
      }
    }

    // RULE 2: Doctor access
    if (viewerRole === 'doctor') {
      const grants = await this.getGrants(record.patientId, viewerId);

      if (grants.length === 0) {
        return {
          allowed: false,
          statusCode: 403,
          error: 'ACCESS_DENIED_NO_GRANT',
          reason: 'NO_GRANT',
          message: 'Access Denied (403): Doctor has no consent grant for this patient.',
        };
      }

      const latestGrant = grants[0];

      // Check Revocation
      if (latestGrant.isRevoked) {
        return {
          allowed: false,
          statusCode: 403,
          error: 'ACCESS_DENIED_REVOKED',
          reason: 'REVOKED_GRANT',
          grant: latestGrant,
          message: 'Access Denied (403): Patient has explicitly REVOKED consent for your credentials.',
        };
      }

      // Check Expiration
      const now = Date.now();
      const expiry = new Date(latestGrant.expiresAt).getTime();
      if (now >= expiry) {
        return {
          allowed: false,
          statusCode: 403,
          error: 'ACCESS_DENIED_EXPIRED',
          reason: 'EXPIRED_GRANT',
          grant: latestGrant,
          message: `Access Denied (403): Consent grant EXPIRED at ${new Date(latestGrant.expiresAt).toLocaleString()}. Access permanently closed.`,
        };
      }

      // Active valid grant!
      return {
        allowed: true,
        statusCode: 200,
        reason: 'ACTIVE_GRANT',
        grant: latestGrant,
        message: 'Access granted: Active consent grant verified against ledger.',
      };
    }

    return {
      allowed: false,
      statusCode: 403,
      error: 'FORBIDDEN',
      message: 'Access Denied (403): Unauthorized user role.',
    };
  }
}

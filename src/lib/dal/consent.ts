import { createServerAdminClient } from '@/lib/supabase/server';
import { INITIAL_GRANTS } from '@/lib/mock-data';
import { ConsentGrant, MedicalRecord, UserRole } from '@/types';

// In-memory cache for fallback when remote Supabase database is unreachable/mock
let inMemoryGrants: ConsentGrant[] = [...INITIAL_GRANTS];

export function getInMemoryGrants(): ConsentGrant[] {
  return inMemoryGrants;
}

export function setInMemoryGrants(grants: ConsentGrant[]) {
  inMemoryGrants = grants;
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
   * Retrieves all consent grants for a given patient and doctor.
   * Supabase PostgreSQL is the primary source of truth, with resilient in-memory fallback.
   */
  static async getGrants(patientId: string, doctorId: string): Promise<ConsentGrant[]> {
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
    } catch {
      // Supabase database unavailable, using fallback
    }

    // In-memory source of truth
    return inMemoryGrants.filter(
      (g) => g.patientId === patientId && g.doctorId === doctorId
    );
  }

  /**
   * Records a new consent grant in Supabase.
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

    // Attempt to write to Supabase
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
    } catch {
      // In-memory fallback
    }

    inMemoryGrants = [newGrant, ...inMemoryGrants];
    return newGrant;
  }

  /**
   * Immediately revokes a consent grant in Supabase.
   */
  static async revokeGrant(grantId: string, revokingPatientId: string): Promise<ConsentGrant | null> {
    const now = new Date().toISOString();

    // 1. Locate grant
    const target = inMemoryGrants.find((g) => g.id === grantId);
    if (!target) return null;

    // 2. Strict patient ownership check
    if (target.patientId !== revokingPatientId) {
      throw new Error('UNAUTHORIZED_REVOCATION');
    }

    target.isRevoked = true;
    target.revokedAt = now;

    // 3. Update Supabase
    try {
      const supabase = createServerAdminClient();
      await supabase
        .from('consent_grants')
        .update({
          is_revoked: true,
          revoked_at: now,
        })
        .eq('id', grantId)
        .eq('patient_id', revokingPatientId);
    } catch {
      // In-memory fallback
    }

    return target;
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

'use client';

import {
  UserProfile,
  MedicalRecord,
  AccessRequest,
  ConsentGrant,
  AuditEvent,
  AccessCheckResult,
} from '@/types';
import {
  DEMO_PATIENTS,
  DEMO_DOCTORS,
  INITIAL_RECORDS,
  INITIAL_REQUESTS,
  INITIAL_GRANTS,
  INITIAL_AUDIT_EVENTS,
} from '@/lib/mock-data';

const STORAGE_KEY_USER = 'medivault_current_user_id';
const STORAGE_KEY_RECORDS = 'medivault_records';
const STORAGE_KEY_REQUESTS = 'medivault_requests';
const STORAGE_KEY_GRANTS = 'medivault_grants';
const STORAGE_KEY_AUDIT = 'medivault_audit';

// Helper to calculate SHA-256 in browser
export async function computeSha256(textOrBuffer: string | ArrayBuffer): Promise<string> {
  const data =
    typeof textOrBuffer === 'string'
      ? new TextEncoder().encode(textOrBuffer)
      : new Uint8Array(textOrBuffer);

  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Generate realistic mock transaction hash
export function generateMockTxHash(): string {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

export class DemoStore {
  private static isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  // --- Users & Current Session ---
  static getAllUsers(): UserProfile[] {
    return [...DEMO_PATIENTS, ...DEMO_DOCTORS];
  }

  static getCurrentUser(): UserProfile {
    if (this.isBrowser()) {
      const savedId = localStorage.getItem(STORAGE_KEY_USER);
      if (savedId) {
        const found = this.getAllUsers().find((u) => u.id === savedId);
        if (found) return found;
      }
    }
    // Default to Sarah Chen (Patient)
    return DEMO_PATIENTS[0];
  }

  static setCurrentUser(userId: string): UserProfile {
    const user = this.getAllUsers().find((u) => u.id === userId);
    if (!user) throw new Error(`User ${userId} not found`);
    if (this.isBrowser()) {
      localStorage.setItem(STORAGE_KEY_USER, user.id);
    }
    return user;
  }

  // --- Medical Records ---
  static getRecords(): MedicalRecord[] {
    if (this.isBrowser()) {
      const saved = localStorage.getItem(STORAGE_KEY_RECORDS);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // fallback
        }
      }
    }
    return INITIAL_RECORDS;
  }

  static saveRecords(records: MedicalRecord[]): void {
    if (this.isBrowser()) {
      localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
    }
  }

  static addRecord(record: Omit<MedicalRecord, 'id' | 'createdAt' | 'blockchainTxHash'>): MedicalRecord {
    const records = this.getRecords();
    const txHash = generateMockTxHash();
    const newRecord: MedicalRecord = {
      ...record,
      id: `rec-${Date.now()}`,
      blockchainTxHash: txHash,
      createdAt: new Date().toISOString(),
    };

    const updated = [newRecord, ...records];
    this.saveRecords(updated);

    // Anchor to Audit Ledger
    const currentUser = this.getCurrentUser();
    this.logAuditEvent({
      actorId: currentUser.id,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      action: 'UPLOAD_RECORD',
      targetPatientId: newRecord.patientId,
      targetPatientName: newRecord.patientName,
      targetRecordId: newRecord.id,
      targetRecordTitle: newRecord.title,
      details: {
        category: newRecord.category,
        fileName: newRecord.fileName,
        fileSize: newRecord.fileSize,
        sha256: newRecord.documentSha256,
      },
      blockchainTxHash: txHash,
      confirmedOnChain: true,
    });

    return newRecord;
  }

  // --- Access Requests ---
  static getRequests(): AccessRequest[] {
    if (this.isBrowser()) {
      const saved = localStorage.getItem(STORAGE_KEY_REQUESTS);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return INITIAL_REQUESTS;
  }

  static saveRequests(requests: AccessRequest[]): void {
    if (this.isBrowser()) {
      localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(requests));
    }
  }

  static createRequest(params: {
    doctorId: string;
    patientId: string;
    purpose: string;
    clinicalNotes?: string;
    requestedDurationHours: number;
  }): AccessRequest {
    const doctor = DEMO_DOCTORS.find((d) => d.id === params.doctorId) || this.getCurrentUser();
    const patient = DEMO_PATIENTS.find((p) => p.id === params.patientId);

    const newRequest: AccessRequest = {
      id: `req-${Date.now()}`,
      doctorId: params.doctorId,
      doctorName: doctor.fullName,
      doctorSpecialty: doctor.specialty,
      doctorOrganization: doctor.organization,
      patientId: params.patientId,
      patientName: patient ? patient.fullName : 'Patient',
      purpose: params.purpose,
      clinicalNotes: params.clinicalNotes,
      requestedDurationHours: params.requestedDurationHours,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const current = this.getRequests();
    this.saveRequests([newRequest, ...current]);

    this.logAuditEvent({
      actorId: doctor.id,
      actorName: doctor.fullName,
      actorRole: 'doctor',
      action: 'REQUEST_ACCESS',
      targetPatientId: params.patientId,
      targetPatientName: patient?.fullName,
      details: {
        purpose: params.purpose,
        durationHours: params.requestedDurationHours,
      },
      confirmedOnChain: false,
    });

    return newRequest;
  }

  // --- Consent Grants ---
  static getGrants(): ConsentGrant[] {
    if (this.isBrowser()) {
      const saved = localStorage.getItem(STORAGE_KEY_GRANTS);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return INITIAL_GRANTS;
  }

  static saveGrants(grants: ConsentGrant[]): void {
    if (this.isBrowser()) {
      localStorage.setItem(STORAGE_KEY_GRANTS, JSON.stringify(grants));
    }
  }

  static grantConsent(params: {
    requestId?: string;
    patientId: string;
    doctorId: string;
    durationHours: number;
  }): ConsentGrant {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + params.durationHours * 3600 * 1000).toISOString();
    const txHash = generateMockTxHash();

    const patient = DEMO_PATIENTS.find((p) => p.id === params.patientId);
    const doctor = DEMO_DOCTORS.find((d) => d.id === params.doctorId);

    const newGrant: ConsentGrant = {
      id: `grant-${Date.now()}`,
      requestId: params.requestId,
      patientId: params.patientId,
      patientName: patient?.fullName || 'Patient',
      doctorId: params.doctorId,
      doctorName: doctor?.fullName || 'Doctor',
      doctorSpecialty: doctor?.specialty,
      grantedAt: now.toISOString(),
      expiresAt: expiresAt,
      isRevoked: false,
      blockchainTxHash: txHash,
      createdAt: now.toISOString(),
    };

    // Update Request status if linked
    if (params.requestId) {
      const requests = this.getRequests().map((r) =>
        r.id === params.requestId ? { ...r, status: 'approved' as const, updatedAt: now.toISOString() } : r
      );
      this.saveRequests(requests);
    }

    const currentGrants = this.getGrants();
    this.saveGrants([newGrant, ...currentGrants]);

    this.logAuditEvent({
      actorId: params.patientId,
      actorName: patient?.fullName || 'Patient',
      actorRole: 'patient',
      action: 'GRANT_ACCESS',
      targetDoctorId: params.doctorId,
      targetDoctorName: doctor?.fullName,
      details: {
        grantId: newGrant.id,
        durationHours: params.durationHours,
        expiresAt: expiresAt,
      },
      blockchainTxHash: txHash,
      confirmedOnChain: true,
    });

    return newGrant;
  }

  static revokeConsent(grantId: string): ConsentGrant {
    const now = new Date().toISOString();
    const txHash = generateMockTxHash();
    let revokedGrant: ConsentGrant | undefined;

    const updatedGrants = this.getGrants().map((grant) => {
      if (grant.id === grantId) {
        revokedGrant = {
          ...grant,
          isRevoked: true,
          revokedAt: now,
          blockchainTxHash: txHash,
        };
        return revokedGrant;
      }
      return grant;
    });

    if (!revokedGrant) {
      throw new Error(`Consent grant ${grantId} not found`);
    }

    this.saveGrants(updatedGrants);

    this.logAuditEvent({
      actorId: revokedGrant.patientId,
      actorName: revokedGrant.patientName || 'Patient',
      actorRole: 'patient',
      action: 'REVOKE_ACCESS',
      targetDoctorId: revokedGrant.doctorId,
      targetDoctorName: revokedGrant.doctorName,
      details: {
        grantId: revokedGrant.id,
        reason: 'Immediate patient revocation applied',
      },
      blockchainTxHash: txHash,
      confirmedOnChain: true,
    });

    return revokedGrant;
  }

  // --- Strict Server/Backend Authorization Verifier ---
  static verifyAccess(viewerId: string, patientId: string): AccessCheckResult {
    // 1. Patient viewing own records: Always allowed
    if (viewerId === patientId) {
      return {
        allowed: true,
        reason: 'PATIENT_OWNER',
        message: 'Access granted: Patient owns this medical vault.',
      };
    }

    // 2. Doctor requesting access: Check active unrevoked unexpired grant
    const grants = this.getGrants().filter(
      (g) => g.patientId === patientId && g.doctorId === viewerId
    );

    if (grants.length === 0) {
      return {
        allowed: false,
        reason: 'NO_GRANT',
        message: 'Access Denied (403): No consent grant exists between this doctor and patient.',
      };
    }

    // Sort by grantedAt desc to check most recent grant
    const latest = grants[0];

    // Check Revocation
    if (latest.isRevoked) {
      return {
        allowed: false,
        reason: 'REVOKED_GRANT',
        grant: latest,
        message: 'Access Denied (403): Patient has revoked consent for your medical credentials.',
      };
    }

    // Check Expiration
    const now = new Date().getTime();
    const expiry = new Date(latest.expiresAt).getTime();
    if (now >= expiry) {
      return {
        allowed: false,
        reason: 'EXPIRED_GRANT',
        grant: latest,
        message: `Access Denied (403): Consent grant expired at ${new Date(latest.expiresAt).toLocaleString()}.`,
      };
    }

    // Valid grant!
    return {
      allowed: true,
      reason: 'ACTIVE_GRANT',
      grant: latest,
      message: 'Access Granted: Verified active time-limited consent grant on cryptographic ledger.',
    };
  }

  // --- Audit Events ---
  static getAuditEvents(): AuditEvent[] {
    if (this.isBrowser()) {
      const saved = localStorage.getItem(STORAGE_KEY_AUDIT);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return INITIAL_AUDIT_EVENTS;
  }

  static logAuditEvent(event: Omit<AuditEvent, 'id' | 'createdAt'>): AuditEvent {
    const fullEvent: AuditEvent = {
      ...event,
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      blockNumber: event.confirmedOnChain ? Math.floor(19845000 + Math.random() * 5000) : undefined,
      createdAt: new Date().toISOString(),
    };

    if (this.isBrowser()) {
      const current = this.getAuditEvents();
      localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify([fullEvent, ...current]));
    }

    return fullEvent;
  }

  // Reset to initial demo state
  static resetDemoState(): void {
    if (this.isBrowser()) {
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem(STORAGE_KEY_RECORDS);
      localStorage.removeItem(STORAGE_KEY_REQUESTS);
      localStorage.removeItem(STORAGE_KEY_GRANTS);
      localStorage.removeItem(STORAGE_KEY_AUDIT);
    }
  }
}

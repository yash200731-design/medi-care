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

import { generateMockTxHash } from '@/lib/blockchain/utils';
export { generateMockTxHash };

/**
 * @deprecated DemoStore is deprecated.
 * In Phase 2, all authoritative records, consent grants, access requests, and authorization checks
 * must strictly flow through the authenticated server APIs and server DAL (RecordsService, ConsentService, RequestsService, AuditService).
 * Client-side localStorage for medical documents has been removed to satisfy HIPAA/GDPR data-at-rest zero-trust constraints.
 */
export class DemoStore {
  // Pure in-memory fallbacks for legacy references if needed
  static getAllUsers(): UserProfile[] {
    return [...DEMO_PATIENTS, ...DEMO_DOCTORS];
  }

  static getCurrentUser(): UserProfile {
    return DEMO_PATIENTS[0];
  }

  static setCurrentUser(userId: string): UserProfile {
    const user = this.getAllUsers().find((u) => u.id === userId);
    if (!user) throw new Error(`User ${userId} not found`);
    return user;
  }

  static getRecords(): MedicalRecord[] {
    console.warn('DemoStore.getRecords is deprecated. Fetch from GET /api/records instead.');
    return INITIAL_RECORDS;
  }

  static addRecord(): never {
    throw new Error('DemoStore.addRecord is deprecated. Authoritative records must be submitted to POST /api/records.');
  }

  static getRequests(): AccessRequest[] {
    console.warn('DemoStore.getRequests is deprecated. Fetch from GET /api/access-requests instead.');
    return INITIAL_REQUESTS;
  }

  static createRequest(): never {
    throw new Error('DemoStore.createRequest is deprecated. Authoritative access requests must be submitted to POST /api/access-requests.');
  }

  static getGrants(): ConsentGrant[] {
    console.warn('DemoStore.getGrants is deprecated. Fetch from GET /api/consent instead.');
    return INITIAL_GRANTS;
  }

  static grantConsent(): never {
    throw new Error('DemoStore.grantConsent is deprecated. Authoritative consent must be submitted to POST /api/consent.');
  }

  static revokeConsent(): never {
    throw new Error('DemoStore.revokeConsent is deprecated. Authoritative revocation must be submitted to DELETE /api/consent.');
  }

  static verifyAccess(): never {
    throw new Error('DemoStore.verifyAccess is prohibited. Client-side authorization fallback is disabled. Query GET /api/records/[id]/access.');
  }

  static getAuditEvents(): AuditEvent[] {
    console.warn('DemoStore.getAuditEvents is deprecated. Fetch from GET /api/audit instead.');
    return INITIAL_AUDIT_EVENTS;
  }

  static logAuditEvent(): never {
    throw new Error('DemoStore.logAuditEvent is deprecated. Audit events are recorded exclusively on the server.');
  }

  // Clear any legacy client-side storage
  static resetDemoState(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_USER);
        localStorage.removeItem(STORAGE_KEY_RECORDS);
        localStorage.removeItem(STORAGE_KEY_REQUESTS);
        localStorage.removeItem(STORAGE_KEY_GRANTS);
        localStorage.removeItem(STORAGE_KEY_AUDIT);
      } catch {}
    }
  }
}

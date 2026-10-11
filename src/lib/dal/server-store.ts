/**
 * MediVault Unified Server Store (Local Demo Mode)
 * Serves as the single authoritative server-side repository when operating in local demo mode,
 * replacing the fragmented and desynced in-memory arrays across individual route files.
 */

import {
  INITIAL_RECORDS,
  INITIAL_GRANTS,
  INITIAL_REQUESTS,
  INITIAL_AUDIT_EVENTS,
} from '@/lib/mock-data';
import {
  MedicalRecord,
  ConsentGrant,
  AccessRequest,
  AuditEvent,
} from '@/types';

// Authoritative module-level collections shared across all API routes in demo mode
let serverRecords: MedicalRecord[] = JSON.parse(JSON.stringify(INITIAL_RECORDS));
let serverGrants: ConsentGrant[] = JSON.parse(JSON.stringify(INITIAL_GRANTS));
let serverRequests: AccessRequest[] = JSON.parse(JSON.stringify(INITIAL_REQUESTS));
let serverAuditEvents: AuditEvent[] = JSON.parse(JSON.stringify(INITIAL_AUDIT_EVENTS));

export class ServerStore {
  // --- Records ---
  static getRecords(): MedicalRecord[] {
    return serverRecords;
  }

  static getRecordById(id: string): MedicalRecord | null {
    return serverRecords.find((r) => r.id === id) || null;
  }

  static getRecordByStoragePath(storagePath: string): MedicalRecord | null {
    return serverRecords.find((r) => r.storagePath === storagePath) || null;
  }

  static addRecord(record: MedicalRecord): MedicalRecord {
    serverRecords = [record, ...serverRecords];
    return record;
  }

  // --- Consent Grants ---
  static getGrants(): ConsentGrant[] {
    return serverGrants;
  }

  static getGrantById(id: string): ConsentGrant | null {
    return serverGrants.find((g) => g.id === id) || null;
  }

  static getGrantsForPair(patientId: string, doctorId: string): ConsentGrant[] {
    return serverGrants.filter(
      (g) => g.patientId === patientId && g.doctorId === doctorId
    );
  }

  static addGrant(grant: ConsentGrant): ConsentGrant {
    serverGrants = [grant, ...serverGrants];
    return grant;
  }

  static revokeGrant(grantId: string, revokingPatientId: string): ConsentGrant | null {
    const target = serverGrants.find((g) => g.id === grantId);
    if (!target) return null;

    if (target.patientId !== revokingPatientId) {
      throw new Error('UNAUTHORIZED_REVOCATION: Grant belongs to another patient.');
    }

    target.isRevoked = true;
    target.revokedAt = new Date().toISOString();
    return target;
  }

  // --- Access Requests ---
  static getRequests(): AccessRequest[] {
    return serverRequests;
  }

  static getRequestById(id: string): AccessRequest | null {
    return serverRequests.find((r) => r.id === id) || null;
  }

  static addRequest(request: AccessRequest): AccessRequest {
    serverRequests = [request, ...serverRequests];
    return request;
  }

  static updateRequestStatus(
    requestId: string,
    status: AccessRequest['status']
  ): AccessRequest | null {
    const target = serverRequests.find((r) => r.id === requestId);
    if (!target) return null;

    target.status = status;
    target.updatedAt = new Date().toISOString();
    return target;
  }

  // --- Audit Events ---
  static getAuditEvents(): AuditEvent[] {
    return serverAuditEvents;
  }

  static addAuditEvent(event: AuditEvent): AuditEvent {
    serverAuditEvents = [event, ...serverAuditEvents];
    return event;
  }

  // --- State Reset for Testing ---
  static resetToInitial(): void {
    serverRecords = JSON.parse(JSON.stringify(INITIAL_RECORDS));
    serverGrants = JSON.parse(JSON.stringify(INITIAL_GRANTS));
    serverRequests = JSON.parse(JSON.stringify(INITIAL_REQUESTS));
    serverAuditEvents = JSON.parse(JSON.stringify(INITIAL_AUDIT_EVENTS));
  }
}

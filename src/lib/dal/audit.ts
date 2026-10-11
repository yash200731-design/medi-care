/**
 * MediVault Audit Events Data Access Layer
 * Handles audit event recording and document integrity verification.
 */

import { createServerAdminClient } from '@/lib/supabase/server';
import { isSupabaseConfigured, assertPersistenceAvailable } from './persistence';
import { ServerStore } from './server-store';
import { AuditEvent, MedicalRecord, UserRole } from '@/types';

export class AuditService {
  /**
   * Retrieves audit events visible to a user based on their identity and role.
   */
  static async getEventsForUser(userId: string, userRole: UserRole): Promise<AuditEvent[]> {
    assertPersistenceAvailable();

    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerAdminClient();
        let query = supabase
          .from('audit_events')
          .select('*')
          .order('created_at', { ascending: false });

        if (userRole === 'patient') {
          query = query.or(`actor_id.eq.${userId},target_patient_id.eq.${userId}`);
        } else if (userRole === 'doctor') {
          query = query.or(`actor_id.eq.${userId},target_doctor_id.eq.${userId}`);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data.map((row) => ({
            id: row.id,
            actorId: row.actor_id,
            actorName: row.details?.actorName || 'User',
            actorRole: row.details?.actorRole || 'patient',
            action: row.action,
            targetPatientId: row.target_patient_id,
            targetPatientName: row.details?.targetPatientName,
            targetDoctorId: row.target_doctor_id,
            targetDoctorName: row.details?.targetDoctorName,
            targetRecordId: row.target_record_id,
            targetRecordTitle: row.details?.targetRecordTitle,
            details: row.details,
            blockchainTxHash: row.blockchain_tx_hash,
            confirmedOnChain: !!row.blockchain_tx_hash && !row.details?.isSimulated,
            isSimulated: row.details?.isSimulated ?? true,
            createdAt: row.created_at,
          }));
        }
      } catch {}
    }

    const allEvents = ServerStore.getAuditEvents();
    if (userRole === 'patient') {
      return allEvents.filter(
        (e) => e.actorId === userId || e.targetPatientId === userId
      );
    } else if (userRole === 'doctor') {
      return allEvents.filter(
        (e) => e.actorId === userId || e.targetDoctorId === userId
      );
    }
    return allEvents;
  }

  /**
   * Logs an authoritative audit event.
   */
  static async logEvent(
    event: Omit<AuditEvent, 'id' | 'createdAt'>
  ): Promise<AuditEvent> {
    assertPersistenceAvailable();

    const fullEvent: AuditEvent = {
      ...event,
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerAdminClient();
        await supabase.from('audit_events').insert({
          id: fullEvent.id,
          actor_id: fullEvent.actorId,
          action: fullEvent.action,
          target_patient_id: fullEvent.targetPatientId,
          target_doctor_id: fullEvent.targetDoctorId,
          target_record_id: fullEvent.targetRecordId,
          details: {
            ...fullEvent.details,
            actorName: fullEvent.actorName,
            actorRole: fullEvent.actorRole,
            targetPatientName: fullEvent.targetPatientName,
            targetDoctorName: fullEvent.targetDoctorName,
            targetRecordTitle: fullEvent.targetRecordTitle,
            isSimulated: fullEvent.isSimulated,
          },
          blockchain_tx_hash: fullEvent.blockchainTxHash,
          created_at: fullEvent.createdAt,
        });
      } catch {}
    }

    return ServerStore.addAuditEvent(fullEvent);
  }

  /**
   * Verifies document SHA-256 against anchored records.
   */
  static async verifyDocumentIntegrity(
    documentSha256: string
  ): Promise<{ verified: boolean; record?: MedicalRecord }> {
    assertPersistenceAvailable();

    const cleanHash = documentSha256.toLowerCase().trim();

    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerAdminClient();
        const { data, error } = await supabase
          .from('medical_records')
          .select('*')
          .eq('document_sha256', cleanHash)
          .single();

        if (!error && data) {
          return {
            verified: true,
            record: {
              id: data.id,
              patientId: data.patient_id,
              patientName: data.patient_name || 'Patient',
              title: data.title,
              description: data.description,
              category: data.category,
              storagePath: data.storage_path,
              fileName: data.file_name,
              fileSize: data.file_size,
              mimeType: data.mime_type,
              documentSha256: data.document_sha256,
              blockchainTxHash: data.blockchain_tx_hash,
              createdAt: data.created_at,
            },
          };
        }
      } catch {}
    }

    const match = ServerStore.getRecords().find(
      (r) => r.documentSha256.toLowerCase() === cleanHash
    );

    if (match) {
      return { verified: true, record: match };
    }

    return { verified: false };
  }
}

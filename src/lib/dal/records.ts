/**
 * MediVault Records Data Access Layer
 * Handles medical record persistence through Supabase PostgreSQL when configured,
 * or through the authoritative ServerStore in local demo mode.
 */

import { createServerAdminClient } from '@/lib/supabase/server';
import { isSupabaseConfigured, assertPersistenceAvailable } from './persistence';
import { ServerStore } from './server-store';
import { ConsentService } from './consent';
import { MedicalRecord, UserRole } from '@/types';

export class RecordsService {
  /**
   * Retrieves records for a patient or authorized doctor.
   */
  static async getRecordsForUser(
    userId: string,
    userRole: UserRole,
    requestedPatientId?: string | null
  ): Promise<MedicalRecord[]> {
    assertPersistenceAvailable();

    // 1. Patient: only their own records
    if (userRole === 'patient') {
      if (requestedPatientId && requestedPatientId !== userId) {
        throw new Error('FORBIDDEN: Cross-patient vault query blocked.');
      }
      return this.getRecordsByPatientId(userId);
    }

    // 2. Doctor: records for authorized patients only
    if (userRole === 'doctor') {
      if (requestedPatientId) {
        // Doctor must have active grant for this specific patient
        const grants = await ConsentService.getGrants(requestedPatientId, userId);
        const activeGrant = grants.find(
          (g) => !g.isRevoked && new Date(g.expiresAt).getTime() > Date.now()
        );
        if (!activeGrant) {
          throw new Error('FORBIDDEN: Doctor lacks active consent grant for this patient.');
        }
        return this.getRecordsByPatientId(requestedPatientId);
      }

      // If no specific patient requested, find all patients this doctor has active grants for
      const allGrants = await ConsentService.getAllGrantsForDoctor(userId);
      const authorizedPatientIds = new Set(
        allGrants
          .filter((g) => !g.isRevoked && new Date(g.expiresAt).getTime() > Date.now())
          .map((g) => g.patientId)
      );

      const allRecords = await this.getAllRecords();
      return allRecords.filter((r) => authorizedPatientIds.has(r.patientId));
    }

    throw new Error(`FORBIDDEN: Role '${userRole}' cannot query records.`);
  }

  /**
   * Retrieves all records owned by a patient.
   */
  static async getRecordsByPatientId(patientId: string): Promise<MedicalRecord[]> {
    assertPersistenceAvailable();

    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerAdminClient();
        const { data, error } = await supabase
          .from('medical_records')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((row) => ({
            id: row.id,
            patientId: row.patient_id,
            patientName: row.patient_name || 'Patient',
            title: row.title,
            description: row.description,
            category: row.category,
            storagePath: row.storage_path,
            fileName: row.file_name,
            fileSize: row.file_size,
            mimeType: row.mime_type,
            documentSha256: row.document_sha256,
            blockchainTxHash: row.blockchain_tx_hash,
            createdAt: row.created_at,
          }));
        }
      } catch {
        // Fall back to server store if transient Supabase error
      }
    }

    return ServerStore.getRecords().filter((r) => r.patientId === patientId);
  }

  /**
   * Retrieves a single record by ID.
   */
  static async getRecordById(recordId: string): Promise<MedicalRecord | null> {
    assertPersistenceAvailable();

    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerAdminClient();
        const { data, error } = await supabase
          .from('medical_records')
          .select('*')
          .eq('id', recordId)
          .single();

        if (!error && data) {
          return {
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
          };
        }
      } catch {}
    }

    return ServerStore.getRecordById(recordId);
  }

  /**
   * Retrieves a single record by storage path.
   */
  static async getRecordByStoragePath(storagePath: string): Promise<MedicalRecord | null> {
    assertPersistenceAvailable();

    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerAdminClient();
        const { data, error } = await supabase
          .from('medical_records')
          .select('*')
          .eq('storage_path', storagePath)
          .single();

        if (!error && data) {
          return {
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
          };
        }
      } catch {}
    }

    return ServerStore.getRecordByStoragePath(storagePath);
  }

  /**
   * Persists a new medical record.
   */
  static async createRecord(record: MedicalRecord): Promise<MedicalRecord> {
    assertPersistenceAvailable();

    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerAdminClient();
        await supabase.from('medical_records').insert({
          id: record.id,
          patient_id: record.patientId,
          title: record.title,
          description: record.description,
          category: record.category,
          storage_path: record.storagePath,
          file_name: record.fileName,
          file_size: record.fileSize,
          mime_type: record.mimeType,
          document_sha256: record.documentSha256,
          blockchain_tx_hash: record.blockchainTxHash,
          created_at: record.createdAt,
        });
      } catch {}
    }

    return ServerStore.addRecord(record);
  }

  /**
   * Returns all records (internal helper).
   */
  static async getAllRecords(): Promise<MedicalRecord[]> {
    return ServerStore.getRecords();
  }
}

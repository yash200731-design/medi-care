export type UserRole = 'patient' | 'doctor' | 'admin';

export interface UserProfile {
  id: string;
  role: UserRole;
  fullName: string;
  email: string;
  licenseNumber?: string;
  specialty?: string;
  organization?: string;
  phone?: string;
  avatarUrl?: string;
  createdAt: string;
}

export type RecordCategory =
  | 'Lab Report'
  | 'Imaging & Radiology'
  | 'Prescription'
  | 'Clinical Note'
  | 'Discharge Summary'
  | 'Genomic & Cardiology';

export interface MedicalRecord {
  id: string;
  patientId: string;
  patientName?: string;
  title: string;
  description?: string;
  category: RecordCategory;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  documentSha256: string;
  blockchainTxHash?: string;
  createdAt: string;
  contentPreview?: string; // Synthetic text content for demo preview
}

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected' | 'revoked' | 'expired';

export interface AccessRequest {
  id: string;
  doctorId: string;
  doctorName?: string;
  doctorSpecialty?: string;
  doctorOrganization?: string;
  patientId: string;
  patientName?: string;
  purpose: string;
  clinicalNotes?: string;
  requestedDurationHours: number;
  status: AccessRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ConsentGrant {
  id: string;
  requestId?: string;
  patientId: string;
  patientName?: string;
  doctorId: string;
  doctorName?: string;
  doctorSpecialty?: string;
  grantedAt: string;
  expiresAt: string;
  isRevoked: boolean;
  revokedAt?: string;
  blockchainTxHash?: string;
  createdAt: string;
}

export type AuditAction =
  | 'UPLOAD_RECORD'
  | 'REQUEST_ACCESS'
  | 'GRANT_ACCESS'
  | 'REVOKE_ACCESS'
  | 'ACCESS_RECORD'
  | 'ACCESS_DENIED_EXPIRED'
  | 'ACCESS_DENIED_REVOKED'
  | 'ACCESS_DENIED_UNAUTHORIZED';

export interface AuditEvent {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: AuditAction;
  targetPatientId?: string;
  targetPatientName?: string;
  targetDoctorId?: string;
  targetDoctorName?: string;
  targetRecordId?: string;
  targetRecordTitle?: string;
  details: Record<string, unknown>;
  blockchainTxHash?: string;
  blockNumber?: number;
  confirmedOnChain: boolean;
  createdAt: string;
}

export interface BlockchainReceipt {
  transactionHash: string;
  blockNumber: number;
  from: string;
  to: string;
  status: 1 | 0; // 1 = confirmed success
  timestamp: string;
  gasUsed?: string;
}

export interface AccessCheckResult {
  allowed: boolean;
  reason?: 'ACTIVE_GRANT' | 'PATIENT_OWNER' | 'EXPIRED_GRANT' | 'REVOKED_GRANT' | 'NO_GRANT';
  grant?: ConsentGrant;
  message: string;
}

import { UserProfile, MedicalRecord, AccessRequest, ConsentGrant, AuditEvent } from '@/types';

// ==============================================================================
// Synthetic Demo Patients & Doctors (No real patient data exposed)
// ==============================================================================

export const DEMO_PATIENTS: UserProfile[] = [
  {
    id: 'patient-sarah-101',
    role: 'patient',
    fullName: 'Sarah Chen',
    email: 'sarah.chen@example-patient.net',
    phone: '+1 (555) 234-8901',
    organization: 'Self-Enrolled Patient',
    createdAt: '2026-01-15T08:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'patient-marcus-102',
    role: 'patient',
    fullName: 'Marcus Rivera',
    email: 'marcus.rivera@example-patient.net',
    phone: '+1 (555) 872-4321',
    organization: 'Self-Enrolled Patient',
    createdAt: '2026-02-10T10:30:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'patient-elena-103',
    role: 'patient',
    fullName: 'Elena Rostova',
    email: 'elena.rostova@example-patient.net',
    phone: '+1 (555) 654-1189',
    organization: 'Self-Enrolled Patient',
    createdAt: '2026-03-01T14:15:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  },
];

export const DEMO_DOCTORS: UserProfile[] = [
  {
    id: 'doctor-thorne-201',
    role: 'doctor',
    fullName: 'Dr. Aris Thorne, MD, FACC',
    email: 'dr.thorne@cardio-institute.org',
    licenseNumber: 'MD-NY-849204',
    specialty: 'Cardiovascular Surgery & Electrophysiology',
    organization: 'St. Jude Metropolitan Heart Hospital',
    phone: '+1 (555) 902-1244',
    createdAt: '2025-11-20T09:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'doctor-patel-202',
    role: 'doctor',
    fullName: 'Dr. Maya Patel, MD, PhD',
    email: 'm.patel@neurovanguard.org',
    licenseNumber: 'MD-CA-330192',
    specialty: 'Neurology & Cognitive Neuroimaging',
    organization: 'Pacific NeuroVanguard Clinic',
    phone: '+1 (555) 441-9800',
    createdAt: '2025-12-05T11:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1594824813583-49d71a8f9468?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'doctor-vance-203',
    role: 'doctor',
    fullName: 'Dr. Julian Vance, MD',
    email: 'j.vance@oncology-partners.med',
    licenseNumber: 'MD-TX-774019',
    specialty: 'Precision Oncology & Cellular Therapy',
    organization: 'Memorial Cancer Research Center',
    phone: '+1 (555) 782-3901',
    createdAt: '2026-01-08T15:20:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&auto=format&fit=crop&q=80',
  },
];

// ==============================================================================
// Synthetic Medical Records with SHA-256 Hashes
// ==============================================================================

export const INITIAL_RECORDS: MedicalRecord[] = [
  {
    id: 'rec-cardiac-mri-001',
    patientId: 'patient-sarah-101',
    patientName: 'Sarah Chen',
    title: 'Cardiac 3T MRI with Late Gadolinium Enhancement',
    description: 'Biventricular volumetric analysis, myocardial viability, and perfusion assessment for atypical chest discomfort.',
    category: 'Imaging & Radiology',
    storagePath: 'patient-sarah-101/cardiac-mri-20260301.pdf',
    fileName: 'Cardiac_MRI_Study_Chen_Sarah.pdf',
    fileSize: 4210740, // 4.2 MB
    mimeType: 'application/pdf',
    // Precalculated SHA-256 digest
    documentSha256: '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca7',
    blockchainTxHash: '0x3a48e79b1d9c02ff4352abcf768b12e845c47df1aa769a239cb14e21a208031a',
    createdAt: '2026-03-01T10:15:00Z',
    contentPreview: `CLINICAL INDICATION: 38-year-old female evaluating exertional dyspnea and atypical angina.
FINDINGS:
- Left ventricular end-diastolic volume: 134 mL (normal index: 68 mL/m2).
- Left ventricular ejection fraction (LVEF): 62% (Preserved systolic function).
- Myocardial perfusion: No inducible ischemia across 16 AHA segments.
- Late Gadolinium Enhancement (LGE): Negative for myocardial fibrosis or scar.
IMPRESSION: Structurally normal myocardium with preserved systolic function. No evidence of myocarditis or ischemic cardiomyopathy.`,
  },
  {
    id: 'rec-lipid-apob-002',
    patientId: 'patient-sarah-101',
    patientName: 'Sarah Chen',
    title: 'Advanced Lipid Subfractionation & High-Sensitivity Troponin I',
    description: 'Comprehensive biomarker assessment including Apolipoprotein B, Lp(a), and hs-CRP.',
    category: 'Lab Report',
    storagePath: 'patient-sarah-101/lipids-biomarkers-20260310.pdf',
    fileName: 'Quest_Diagnostics_Advanced_Panel.pdf',
    fileSize: 845200,
    mimeType: 'application/pdf',
    documentSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    blockchainTxHash: '0x5c8e19bf1841dc39a89c9f0b1a039774628ef40a6b18a1a3617300c0211a73ee',
    createdAt: '2026-03-10T08:45:00Z',
    contentPreview: `LABORATORY ANALYSIS REPORT:
- Total Cholesterol: 182 mg/dL (Reference: <200)
- Apolipoprotein B (ApoB): 78 mg/dL (Optimal: <80 mg/dL)
- High-Sensitivity Troponin I (hs-TnI): < 1.8 pg/mL (Normal / Negative)
- High-Sensitivity C-Reactive Protein (hs-CRP): 0.6 mg/L (Low cardiovascular risk)
- Lipoprotein(a): 22 nmol/L (Reference: <75 nmol/L)
INTERPRETATION: Excellent cardiometabolic biomarker profile. Minimal vascular inflammatory activity.`,
  },
  {
    id: 'rec-holter-ecg-003',
    patientId: 'patient-sarah-101',
    patientName: 'Sarah Chen',
    title: '72-Hour Continuous Patch Holter Electrocardiography',
    description: 'Continuous ambulatory ECG monitoring for episodic palpitations.',
    category: 'Genomic & Cardiology',
    storagePath: 'patient-sarah-101/holter-patch-20260314.pdf',
    fileName: 'ZioXT_72hr_Patch_Summary.pdf',
    fileSize: 1943000,
    mimeType: 'application/pdf',
    documentSha256: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
    blockchainTxHash: '0x88f01b1cb9a94165d214697f2679c88be2387123985790ac388bbd02941fa412',
    createdAt: '2026-03-14T16:00:00Z',
    contentPreview: `MONITORING DURATION: 71.8 hours total analyzable time.
- Predominant Rhythm: Normal Sinus Rhythm (NSR).
- Heart Rate Range: Minimum 49 bpm (sleep), Average 68 bpm, Peak 132 bpm (exercise).
- Ventricular Ectopy: Isolated PVC burden 0.02% (no couplets or sustained VT).
- Supraventricular Ectopy: PAC burden < 0.01%. No atrial fibrillation or flutter.
- Patient Trigger Logs: 3 symptom buttons correlated strictly with sinus tachycardia (98-106 bpm).`,
  },
  {
    id: 'rec-neuro-eeg-004',
    patientId: 'patient-marcus-102',
    patientName: 'Marcus Rivera',
    title: 'High-Density 64-Channel Video EEG Telemetry Report',
    description: 'Evaluation of nocturnal spells and sleep architecture.',
    category: 'Clinical Note',
    storagePath: 'patient-marcus-102/eeg-telemetry-20260218.pdf',
    fileName: 'NeuroVanguard_HD_EEG_Report.pdf',
    fileSize: 3120000,
    mimeType: 'application/pdf',
    documentSha256: '72b0c34598fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b11a',
    blockchainTxHash: '0x17c919bf1841dc39a89c9f0b1a039774628ef40a6b18a1a3617300c0211a998c',
    createdAt: '2026-02-18T11:20:00Z',
    contentPreview: `CLINICAL HISTORY: 45-year-old male with suspected nocturnal parasomnia versus frontal lobe epilepsy.
ELECTROGRAPHIC FINDINGS:
- Background: Well-organized 9.5 Hz posterior dominant rhythm with symmetric reactivity.
- Sleep Architecture: Normal progression of N1, N2, N3, and REM sleep.
- Paroxysmal Activity: No spike-and-wave discharges, sharp waves, or focal epileptiform abnormalities.
CONCLUSION: Normal ambulatory EEG monitoring. Nocturnal arousals correlate with benign parasomnia.`,
  },
];

// ==============================================================================
// Pre-populated Access Requests (Demonstrating pending, approved, expired states)
// ==============================================================================

export const INITIAL_REQUESTS: AccessRequest[] = [
  {
    id: 'req-active-001',
    doctorId: 'doctor-thorne-201',
    doctorName: 'Dr. Aris Thorne, MD, FACC',
    doctorSpecialty: 'Cardiovascular Surgery',
    doctorOrganization: 'St. Jude Metropolitan Heart Hospital',
    patientId: 'patient-sarah-101',
    patientName: 'Sarah Chen',
    purpose: 'Cardiovascular Clearance & MRI Review for Outpatient Consultation',
    clinicalNotes: 'Evaluating non-ischemic dyspnea and reviewing recent 3T Cardiac MRI prior to scheduled exercise stress protocol.',
    requestedDurationHours: 24,
    status: 'approved',
    createdAt: '2026-10-09T18:00:00Z',
    updatedAt: '2026-10-09T19:00:00Z',
  },
  {
    id: 'req-pending-002',
    doctorId: 'doctor-vance-203',
    doctorName: 'Dr. Julian Vance, MD',
    doctorSpecialty: 'Precision Oncology',
    doctorOrganization: 'Memorial Cancer Research Center',
    patientId: 'patient-sarah-101',
    patientName: 'Sarah Chen',
    purpose: 'Preventive Genomic Screening Consultation',
    clinicalNotes: 'Patient expressed interest in hereditary cardiac and metabolic panel consultation.',
    requestedDurationHours: 48,
    status: 'pending',
    createdAt: '2026-10-10T08:30:00Z',
    updatedAt: '2026-10-10T08:30:00Z',
  },
  {
    id: 'req-expired-003',
    doctorId: 'doctor-patel-202',
    doctorName: 'Dr. Maya Patel, MD, PhD',
    doctorSpecialty: 'Neurology',
    doctorOrganization: 'Pacific NeuroVanguard Clinic',
    patientId: 'patient-sarah-101',
    patientName: 'Sarah Chen',
    purpose: 'Vestibular / Migraine Differential Evaluation',
    clinicalNotes: 'Historical consult concluded; time grant has lapsed.',
    requestedDurationHours: 1,
    status: 'expired',
    createdAt: '2026-10-01T12:00:00Z',
    updatedAt: '2026-10-01T12:05:00Z',
  },
];

// ==============================================================================
// Pre-populated Consent Grants (Active, Expired, Revoked)
// ==============================================================================

// Helper to construct ISO dates relative to now
const now = new Date();
const inTwentyHours = new Date(now.getTime() + 20 * 60 * 60 * 1000).toISOString();
const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
const nineDaysAgo = new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000).toISOString();
const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();

export const INITIAL_GRANTS: ConsentGrant[] = [
  {
    id: 'grant-active-001',
    requestId: 'req-active-001',
    patientId: 'patient-sarah-101',
    patientName: 'Sarah Chen',
    doctorId: 'doctor-thorne-201',
    doctorName: 'Dr. Aris Thorne, MD, FACC',
    doctorSpecialty: 'Cardiovascular Surgery',
    grantedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
    expiresAt: inTwentyHours, // Still ACTIVE for ~20 hours
    isRevoked: false,
    blockchainTxHash: '0x2bf7a834190c4217ee999901adffca7389100010cb7264850fa9103c80911bc1',
    createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'grant-expired-002',
    requestId: 'req-expired-003',
    patientId: 'patient-sarah-101',
    patientName: 'Sarah Chen',
    doctorId: 'doctor-patel-202',
    doctorName: 'Dr. Maya Patel, MD, PhD',
    doctorSpecialty: 'Neurology',
    grantedAt: tenDaysAgo,
    expiresAt: nineDaysAgo, // EXPIRED in the past!
    isRevoked: false,
    blockchainTxHash: '0x7e889a244101cc2971ea91741122a009fb71624097463009b78ca90100f77218',
    createdAt: tenDaysAgo,
  },
  {
    id: 'grant-revoked-003',
    patientId: 'patient-sarah-101',
    patientName: 'Sarah Chen',
    doctorId: 'doctor-vance-203',
    doctorName: 'Dr. Julian Vance, MD',
    doctorSpecialty: 'Precision Oncology',
    grantedAt: twoDaysAgo,
    expiresAt: inTwentyHours,
    isRevoked: true, // EXPLICITLY REVOKED by Patient!
    revokedAt: oneDayAgo,
    blockchainTxHash: '0x99a1cb789123405bcca87123ef8910356247810aa102874bbcca901173612854',
    createdAt: twoDaysAgo,
  },
];

// ==============================================================================
// Pre-populated Audit Ledger Events
// ==============================================================================

export const INITIAL_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'aud-001',
    actorId: 'patient-sarah-101',
    actorName: 'Sarah Chen',
    actorRole: 'patient',
    action: 'UPLOAD_RECORD',
    targetRecordId: 'rec-cardiac-mri-001',
    targetRecordTitle: 'Cardiac 3T MRI with Late Gadolinium Enhancement',
    details: {
      category: 'Imaging & Radiology',
      fileSize: 4210740,
      sha256: '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca7',
    },
    blockchainTxHash: '0x3a48e79b1d9c02ff4352abcf768b12e845c47df1aa769a239cb14e21a208031a',
    blockNumber: 19842100,
    confirmedOnChain: true,
    createdAt: '2026-03-01T10:15:02Z',
  },
  {
    id: 'aud-002',
    actorId: 'doctor-thorne-201',
    actorName: 'Dr. Aris Thorne, MD, FACC',
    actorRole: 'doctor',
    action: 'REQUEST_ACCESS',
    targetPatientId: 'patient-sarah-101',
    targetPatientName: 'Sarah Chen',
    details: {
      requestedDurationHours: 24,
      purpose: 'Cardiovascular Clearance & MRI Review for Outpatient Consultation',
    },
    confirmedOnChain: false,
    createdAt: '2026-10-09T18:00:00Z',
  },
  {
    id: 'aud-003',
    actorId: 'patient-sarah-101',
    actorName: 'Sarah Chen',
    actorRole: 'patient',
    action: 'GRANT_ACCESS',
    targetDoctorId: 'doctor-thorne-201',
    targetDoctorName: 'Dr. Aris Thorne, MD, FACC',
    details: {
      grantId: 'grant-active-001',
      durationHours: 24,
      expiresAt: inTwentyHours,
    },
    blockchainTxHash: '0x2bf7a834190c4217ee999901adffca7389100010cb7264850fa9103c80911bc1',
    blockNumber: 19845112,
    confirmedOnChain: true,
    createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'aud-004',
    actorId: 'patient-sarah-101',
    actorName: 'Sarah Chen',
    actorRole: 'patient',
    action: 'REVOKE_ACCESS',
    targetDoctorId: 'doctor-vance-203',
    targetDoctorName: 'Dr. Julian Vance, MD',
    details: {
      grantId: 'grant-revoked-003',
      reason: 'Patient requested immediate revocation of consulting privileges',
    },
    blockchainTxHash: '0x99a1cb789123405bcca87123ef8910356247810aa102874bbcca901173612854',
    blockNumber: 19845240,
    confirmedOnChain: true,
    createdAt: oneDayAgo,
  },
];

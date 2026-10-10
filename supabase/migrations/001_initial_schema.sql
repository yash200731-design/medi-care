-- ==============================================================================
-- MediVault: Patient-Controlled Medical Records Database Schema & RLS Policies
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Profiles Table (Patients & Doctors)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    license_number TEXT,
    specialty TEXT,
    organization TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Medical Records Table
CREATE TABLE IF NOT EXISTS public.medical_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN (
        'Lab Report', 
        'Imaging & Radiology', 
        'Prescription', 
        'Clinical Note', 
        'Discharge Summary', 
        'Genomic & Cardiology'
    )),
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    document_sha256 TEXT NOT NULL,
    blockchain_tx_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Access Requests Table
CREATE TABLE IF NOT EXISTS public.access_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL,
    clinical_notes TEXT,
    requested_duration_hours INTEGER NOT NULL DEFAULT 24 CHECK (requested_duration_hours > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revoked', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Consent Grants Table (Time-limited, immediately revocable)
CREATE TABLE IF NOT EXISTS public.consent_grants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES public.access_requests(id) ON DELETE SET NULL,
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    revoked_at TIMESTAMPTZ,
    blockchain_tx_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_grant_window CHECK (expires_at > granted_at)
);

-- 6. Audit Events Table
CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN (
        'UPLOAD_RECORD',
        'REQUEST_ACCESS',
        'GRANT_ACCESS',
        'REVOKE_ACCESS',
        'ACCESS_RECORD',
        'ACCESS_DENIED_EXPIRED',
        'ACCESS_DENIED_REVOKED',
        'ACCESS_DENIED_UNAUTHORIZED'
    )),
    target_patient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}'::jsonb,
    blockchain_tx_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Indexes for High Performance Queries & Access Checks
CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON public.medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_doctor ON public.access_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_patient ON public.access_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON public.access_requests(status);
CREATE INDEX IF NOT EXISTS idx_consent_grants_lookup ON public.consent_grants(patient_id, doctor_id, is_revoked, expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON public.audit_events(created_at DESC);

-- ==============================================================================
-- Row-Level Security (RLS) Setup
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can read their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Patients and Doctors can view counterpart profiles for legitimate access"
    ON public.profiles FOR SELECT
    USING (
        role = 'doctor' 
        OR auth.uid() = id 
        OR EXISTS (
            SELECT 1 FROM public.consent_grants 
            WHERE (patient_id = profiles.id AND doctor_id = auth.uid())
               OR (doctor_id = profiles.id AND patient_id = auth.uid())
        )
        OR EXISTS (
            SELECT 1 FROM public.access_requests 
            WHERE (patient_id = profiles.id AND doctor_id = auth.uid())
               OR (doctor_id = profiles.id AND patient_id = auth.uid())
        )
    );

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile on signup"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Medical Records Policies
CREATE POLICY "Patients have full control over their own medical records"
    ON public.medical_records FOR ALL
    USING (auth.uid() = patient_id)
    WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Doctors can read medical records ONLY with active unrevoked unexpired grant"
    ON public.medical_records FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.consent_grants cg
            WHERE cg.patient_id = medical_records.patient_id
              AND cg.doctor_id = auth.uid()
              AND cg.is_revoked = false
              AND cg.expires_at > now()
        )
    );

-- Access Requests Policies
CREATE POLICY "Doctors can insert access requests"
    ON public.access_requests FOR INSERT
    WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "Doctors can view access requests they created"
    ON public.access_requests FOR SELECT
    USING (auth.uid() = doctor_id);

CREATE POLICY "Patients can view access requests directed to them"
    ON public.access_requests FOR SELECT
    USING (auth.uid() = patient_id);

CREATE POLICY "Patients can update status of access requests directed to them"
    ON public.access_requests FOR UPDATE
    USING (auth.uid() = patient_id)
    WITH CHECK (auth.uid() = patient_id);

-- Consent Grants Policies
CREATE POLICY "Patients have control over their consent grants"
    ON public.consent_grants FOR ALL
    USING (auth.uid() = patient_id)
    WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Doctors can view grants assigned to them"
    ON public.consent_grants FOR SELECT
    USING (auth.uid() = doctor_id);

-- Audit Events Policies
CREATE POLICY "Users can view audit events involving them"
    ON public.audit_events FOR SELECT
    USING (
        auth.uid() = actor_id 
        OR auth.uid() = target_patient_id 
        OR auth.uid() = target_doctor_id
    );

CREATE POLICY "Authenticated users and services can insert audit events"
    ON public.audit_events FOR INSERT
    WITH CHECK (auth.uid() = actor_id);

-- ==============================================================================
-- Storage Bucket Setup (Private Storage for Medical Files)
-- ==============================================================================

-- Create private bucket 'medical-records' if storage schema exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'medical-records',
    'medical-records',
    false,
    52428800, -- 50 MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/dicom', 'text/plain']
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage RLS: Deny all public access; Patient can upload and read their own folder
CREATE POLICY "Patients manage own storage files"
    ON storage.objects FOR ALL
    USING (bucket_id = 'medical-records' AND auth.uid()::text = (storage.foldername(name))[1])
    WITH CHECK (bucket_id = 'medical-records' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Doctors are NEVER allowed direct storage.objects select; all access goes via signed URL
-- generated after server-side verification of active unexpired unrevoked consent grant.

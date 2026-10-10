-- ==============================================================================
-- Migration 002_hardening.sql: Security Hardening & Zero-Trust RLS Policies
-- ==============================================================================

-- 1. FIX: Role Escalation Protection on Profiles
-- Prevent users from updating their own 'role' column to elevate privileges.

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Security Violation: Direct modification of profile role is strictly prohibited.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_role_escalation();

-- Drop and recreate Profiles UPDATE policy with explicit role check
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile fields"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id 
        AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    );

-- 2. FIX: Overly Permissive Profile Read Policy
-- Drop loose counterpart reading and enforce strict least-privilege scoping.
DROP POLICY IF EXISTS "Patients and Doctors can view counterpart profiles for legitimate access" ON public.profiles;

-- Allow authenticated users to view doctor profiles in the practitioner directory
CREATE POLICY "Authenticated users can browse verified doctor directory"
    ON public.profiles FOR SELECT
    USING (role = 'doctor');

-- Allow doctors to read patient profile ONLY if an active grant or pending request exists
CREATE POLICY "Doctors can read patient profile only with active grant or pending request"
    ON public.profiles FOR SELECT
    USING (
        auth.uid() = id
        OR (
            role = 'patient' 
            AND (
                EXISTS (
                    SELECT 1 FROM public.consent_grants cg
                    WHERE cg.patient_id = profiles.id
                      AND cg.doctor_id = auth.uid()
                      AND cg.is_revoked = false
                      AND cg.expires_at > now()
                )
                OR EXISTS (
                    SELECT 1 FROM public.access_requests ar
                    WHERE ar.patient_id = profiles.id
                      AND ar.doctor_id = auth.uid()
                      AND ar.status = 'pending'
                )
            )
        )
    );

-- 3. FIX: Medical Records Role Enforcement on INSERT
-- Prevent non-patient roles from inserting records into vaults.
DROP POLICY IF EXISTS "Patients have full control over their own medical records" ON public.medical_records;

CREATE POLICY "Patients can view their own medical records"
    ON public.medical_records FOR SELECT
    USING (auth.uid() = patient_id);

CREATE POLICY "Patients can insert their own medical records"
    ON public.medical_records FOR INSERT
    WITH CHECK (
        auth.uid() = patient_id
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'patient'
        )
    );

CREATE POLICY "Patients can update their own medical records"
    ON public.medical_records FOR UPDATE
    USING (auth.uid() = patient_id)
    WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients can delete their own medical records"
    ON public.medical_records FOR DELETE
    USING (auth.uid() = patient_id);

-- 4. FIX: Consent Grants Immutability & Safe Revocation
-- Separate grant management: Patients cannot tamper with expires_at on update or un-revoke grants.
DROP POLICY IF EXISTS "Patients have control over their consent grants" ON public.consent_grants;

CREATE POLICY "Patients can insert consent grants"
    ON public.consent_grants FOR INSERT
    WITH CHECK (
        auth.uid() = patient_id
        AND expires_at > now()
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'patient'
        )
    );

CREATE POLICY "Patients can only revoke active consent grants"
    ON public.consent_grants FOR UPDATE
    USING (auth.uid() = patient_id)
    WITH CHECK (
        auth.uid() = patient_id
        AND is_revoked = true
        -- Prevent un-revoking or altering expiration window
        AND expires_at = (SELECT cg.expires_at FROM public.consent_grants cg WHERE cg.id = consent_grants.id)
    );

-- 5. FIX: Immutable Audit Events Ledger
-- Ensure audit trail is strictly append-only (no modifications or deletions permitted).
DROP POLICY IF EXISTS "Authenticated users and services can insert audit events" ON public.audit_events;

CREATE POLICY "Authenticated users can insert verified audit events"
    ON public.audit_events FOR INSERT
    WITH CHECK (auth.uid() = actor_id);

-- Prohibit UPDATE and DELETE on audit trail
CREATE POLICY "Audit trail is strictly append-only - No updates"
    ON public.audit_events FOR UPDATE
    USING (false);

CREATE POLICY "Audit trail is strictly append-only - No deletes"
    ON public.audit_events FOR DELETE
    USING (false);

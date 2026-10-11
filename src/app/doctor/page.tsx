'use client';

import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Ban,
  Lock,
  Eye,
  Key,
  CheckCircle2,
  AlertTriangle,
  Send,
  User,
  Activity,
  FileText,
  X,
  History,
} from 'lucide-react';
import { MedicalRecord, UserProfile, AccessCheckResult, ConsentGrant, AccessRequest } from '@/types';
import { DEMO_DOCTORS, DEMO_PATIENTS } from '@/lib/mock-data';

export default function DoctorPortal() {
  const [mounted, setMounted] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(DEMO_PATIENTS[0].id);
  const [activeDoctor, setActiveDoctor] = useState<UserProfile>(DEMO_DOCTORS[0]);

  // Server Data State
  const [allRecords, setAllRecords] = useState<MedicalRecord[]>([]);
  const [doctorGrants, setDoctorGrants] = useState<ConsentGrant[]>([]);
  const [doctorRequests, setDoctorRequests] = useState<AccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Request modal state
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestPurpose, setRequestPurpose] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [requestHours, setRequestHours] = useState(24);
  const [requestStatusMsg, setRequestStatusMsg] = useState<string | null>(null);

  // Protected Record Access State
  const [evaluatingRecordId, setEvaluatingRecordId] = useState<string | null>(null);
  const [accessResult, setAccessResult] = useState<{
    recordId: string;
    result: AccessCheckResult;
    record?: MedicalRecord;
  } | null>(null);

  const fetchDoctorData = async (docId?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [recRes, grantRes, reqRes] = await Promise.all([
        fetch('/api/records', { credentials: 'include' }),
        fetch('/api/consent', { credentials: 'include' }),
        fetch('/api/access-requests', { credentials: 'include' }),
      ]);

      if (!recRes.ok || !grantRes.ok || !reqRes.ok) {
        throw new Error('Failed to retrieve clinical vault data from backend.');
      }

      const recData = await recRes.json();
      const grantData = await grantRes.json();
      const reqData = await reqRes.json();

      setAllRecords(recData.records || []);
      setDoctorGrants(grantData.grants || []);
      setDoctorRequests(reqData.requests || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error syncing doctor portal data';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    // Resolve authenticated doctor session
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data) => {
        if (data && data.authenticated && data.user?.role === 'doctor') {
          setActiveDoctor(data.user);
          await fetchDoctorData(data.user.id);
        } else {
          // Initialize session with Dr. Thorne
          const initRes = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: DEMO_DOCTORS[0].id }),
          });
          const initData = await initRes.json();
          if (initData && initData.user) {
            setActiveDoctor(initData.user);
          }
          await fetchDoctorData(DEMO_DOCTORS[0].id);
        }
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  const handleSwitchDoctor = async (docId: string) => {
    const doc = DEMO_DOCTORS.find((d) => d.id === docId) || DEMO_DOCTORS[0];
    setActiveDoctor(doc);
    setAccessResult(null);
    try {
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: docId }),
      });
      await fetchDoctorData(docId);
    } catch {}
  };

  const selectedPatient =
    DEMO_PATIENTS.find((p) => p.id === selectedPatientId) || DEMO_PATIENTS[0];

  const patientRecords = allRecords.filter(
    (r) => r.patientId === selectedPatient.id
  );

  const grantsForDoctor = doctorGrants.filter(
    (g) => g.patientId === selectedPatient.id && g.doctorId === activeDoctor.id
  );

  const latestGrant = grantsForDoctor.length > 0 ? grantsForDoctor[0] : null;

  // Handler for protected record access with strict zero-trust evaluation
  const handleAccessRecord = async (record: MedicalRecord) => {
    setEvaluatingRecordId(record.id);

    try {
      // Query the authoritative server-side authorization gateway
      const res = await fetch(`/api/records/${record.id}/access`, {
        credentials: 'include',
      });
      const data = await res.json();

      if (res.ok && data.authorized) {
        setAccessResult({
          recordId: record.id,
          result: {
            allowed: true,
            reason: data.reason || 'ACTIVE_GRANT',
            grant: data.grant,
            message: data.message,
          },
          record: data.record || record,
        });
      } else {
        setAccessResult({
          recordId: record.id,
          result: {
            allowed: false,
            reason:
              data.error === 'ACCESS_DENIED_REVOKED'
                ? 'REVOKED_GRANT'
                : data.error === 'ACCESS_DENIED_EXPIRED'
                ? 'EXPIRED_GRANT'
                : 'NO_GRANT',
            message: data.message || 'Access denied by server-side zero-trust authorization gateway.',
          },
          record: undefined,
        });
      }
    } catch {
      // STRICT ZERO-TRUST REQUIREMENT: Never fallback to client-side grant verification!
      // Medical files are NEVER accessible merely because client-side state claims access.
      setAccessResult({
        recordId: record.id,
        result: {
          allowed: false,
          reason: 'NO_GRANT',
          message: 'Server authorization check failed or unreachable. Access strictly denied by zero-trust gate.',
        },
        record: undefined,
      });
    } finally {
      setEvaluatingRecordId(null);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestPurpose.trim()) return;

    try {
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId: selectedPatient.id,
          purpose: requestPurpose.trim(),
          clinicalNotes: requestNotes.trim(),
          requestedDurationHours: requestHours,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit access request');
      }

      await fetchDoctorData(activeDoctor.id);
      setIsRequestModalOpen(false);
      setRequestPurpose('');
      setRequestNotes('');
      setRequestStatusMsg(
        `Access request dispatched to ${selectedPatient.fullName}. Switch to Patient Portal to approve.`
      );
      setTimeout(() => setRequestStatusMsg(null), 6000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting request';
      setErrorMessage(msg);
    }
  };

  if (!mounted) {
    return <div className="p-8 text-center text-slate-500">Loading Doctor Portal...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Alert banner */}
      {requestStatusMsg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
            <span className="text-sm font-semibold">{requestStatusMsg}</span>
          </div>
          <button onClick={() => setRequestStatusMsg(null)}>
            <X className="h-4 w-4 text-blue-600" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <X className="h-5 w-5 text-rose-600 shrink-0" />
            <span className="text-sm font-semibold">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)}>
            <X className="h-4 w-4 text-rose-600" />
          </button>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2">
          <Clock className="h-4 w-4 text-blue-600 animate-spin" />
          <span>Synchronizing patient records and zero-trust consent grants...</span>
        </div>
      )}

      {/* Doctor Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-800">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-400/30">
            <Stethoscope className="h-3.5 w-3.5" />
            <span>Clinical Healthcare Provider Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {activeDoctor.fullName}
          </h1>
          <p className="text-sm text-slate-300 max-w-xl">
            {activeDoctor.specialty} &bull; {activeDoctor.organization} &bull; License:{' '}
            {activeDoctor.licenseNumber}
          </p>
        </div>

        {/* Doctor Persona Switcher for easy testing */}
        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700 space-y-2 w-full md:w-auto">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Test Different Clinician Personas:
          </div>
          <div className="flex flex-wrap gap-2">
            {DEMO_DOCTORS.map((d) => (
              <button
                key={d.id}
                onClick={() => handleSwitchDoctor(d.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeDoctor.id === d.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {d.id === 'doctor-thorne-201' && 'Dr. Thorne (Active Grant)'}
                {d.id === 'doctor-patel-202' && 'Dr. Patel (Expired Grant)'}
                {d.id === 'doctor-vance-203' && 'Dr. Vance (Revoked Grant)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Patient Selector & Access Status */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Select Patient To Review Records
            </h2>
            <p className="text-xs text-slate-500">
              Zero-trust validation executes prior to serving any diagnostic record.
            </p>
          </div>

          <button
            onClick={() => setIsRequestModalOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors self-start sm:self-auto"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Request Consent Access</span>
          </button>
        </div>

        {/* Patient Selection Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {DEMO_PATIENTS.map((p) => {
            const isSelected = p.id === selectedPatient.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedPatientId(p.id);
                  setAccessResult(null);
                }}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/60 shadow-xs ring-1 ring-blue-600'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900">{p.fullName}</div>
                    <div className="text-[11px] text-slate-500">{p.email}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Current Grant Status Card */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-xs">
              <Key className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">
                Grant Status for {activeDoctor.fullName} &bull; {selectedPatient.fullName}
              </div>
              <div className="text-[11px] text-slate-500">
                {latestGrant ? (
                  latestGrant.isRevoked ? (
                    <span className="text-rose-600 font-bold">
                      Revoked by patient at {new Date(latestGrant.revokedAt || '').toLocaleDateString()}
                    </span>
                  ) : new Date(latestGrant.expiresAt).getTime() <= Date.now() ? (
                    <span className="text-amber-600 font-bold">
                      Expired on {new Date(latestGrant.expiresAt).toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-bold">
                      Active: Window closes {new Date(latestGrant.expiresAt).toLocaleTimeString()}
                    </span>
                  )
                ) : (
                  <span className="text-slate-500">No consent grant on record.</span>
                )}
              </div>
            </div>
          </div>

          <div>
            {latestGrant && !latestGrant.isRevoked && new Date(latestGrant.expiresAt).getTime() > Date.now() ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center space-x-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>ACTIVE CONSENT GRANT</span>
              </span>
            ) : latestGrant?.isRevoked ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center space-x-1.5">
                <Ban className="h-3.5 w-3.5 text-rose-600" />
                <span>REVOKED GRANT (403)</span>
              </span>
            ) : latestGrant ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center space-x-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                <span>EXPIRED GRANT (403)</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
                NO GRANT (403)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Patient Medical Records Vault */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">
            {selectedPatient.fullName}&apos;s Encrypted Medical Vault
          </h3>
          <span className="text-xs text-slate-500">
            {patientRecords.length} diagnostic records available
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {patientRecords.map((record) => (
            <div
              key={record.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                    {record.category}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(record.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <h4 className="font-bold text-slate-900 text-base leading-snug">
                  {record.title}
                </h4>

                <p className="text-xs text-slate-600 line-clamp-2">
                  {record.description}
                </p>

                <div className="text-[11px] font-mono text-slate-400 truncate">
                  SHA-256: {record.documentSha256}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {(record.fileSize / 1024 / 1024).toFixed(2)} MB &bull; Protected PDF
                </span>

                <button
                  onClick={() => handleAccessRecord(record)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center space-x-1.5"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Access Protected Record</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ACCESS RESULT MODAL: Shows Allowed or High-Security 403 Forbidden */}
      {accessResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Case 1: ACCESS ALLOWED */}
            {accessResult.result.allowed ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center space-x-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>HTTP 200: Active Consent Verified</span>
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-2">
                      {accessResult.record?.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => setAccessResult(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Active Window Countdown Indicator */}
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-emerald-600 animate-spin" />
                    <div>
                      <div className="text-xs font-bold text-emerald-900">
                        Temporary Authorization Active
                      </div>
                      <div className="text-[11px] text-emerald-700">
                        Expires at {new Date(accessResult.result.grant?.expiresAt || '').toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
                    Active Window
                  </span>
                </div>

                {/* Decrypted Clinical Content */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase">
                    Decrypted Medical Document Preview:
                  </h4>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto border border-slate-800">
                    {accessResult.record?.contentPreview}
                  </pre>
                </div>

                {/* Cryptographic Hash Verification */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1 font-mono text-slate-600">
                  <div className="font-bold text-slate-900 flex items-center space-x-1 font-sans">
                    <ShieldCheck className="h-4 w-4 text-teal-600" />
                    <span>Document Integrity SHA-256 Proof:</span>
                  </div>
                  <div className="break-all select-all text-[11px]">
                    {accessResult.record?.documentSha256}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setAccessResult(null)}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-colors"
                  >
                    Close Decrypted View
                  </button>
                </div>
              </div>
            ) : (
              /* Case 2: ACCESS STRICTLY DENIED (403 FORBIDDEN) */
              <div className="space-y-6">
                <div className="flex items-start justify-between border-b border-rose-100 pb-4">
                  <div className="space-y-1">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center space-x-1.5">
                      <ShieldAlert className="h-4 w-4 text-rose-600" />
                      <span>HTTP 403 FORBIDDEN: ZERO-TRUST REJECTION</span>
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-2">
                      Access Denied by Server-Side Gate
                    </h3>
                  </div>
                  <button
                    onClick={() => setAccessResult(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl space-y-3">
                  <div className="flex items-center space-x-2 text-rose-900 font-bold text-sm">
                    {accessResult.result.reason === 'REVOKED_GRANT' ? (
                      <Ban className="h-5 w-5 text-rose-600 shrink-0" />
                    ) : (
                      <Clock className="h-5 w-5 text-rose-600 shrink-0" />
                    )}
                    <span>
                      {accessResult.result.reason === 'REVOKED_GRANT'
                        ? 'Consent Explicitly Revoked by Patient'
                        : accessResult.result.reason === 'EXPIRED_GRANT'
                        ? 'Consent Grant Time-Window Has Expired'
                        : 'No Active Consent Grant on Ledger'}
                    </span>
                  </div>

                  <p className="text-xs text-rose-800 leading-relaxed">
                    {accessResult.result.message}
                  </p>

                  <div className="pt-2 text-[11px] text-rose-700 border-t border-rose-200/80 font-mono">
                    Violation logged to blockchain audit event ledger with timestamp {new Date().toISOString()}.
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
                  <div className="font-bold text-slate-800">
                    Why did the backend block this request?
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    MediVault enforces strict server-side zero-trust authorization. Even if a doctor
                    knows the file path, the storage bucket disallows download without a verified
                    short-lived signed URL issued strictly upon validating an active, unexpired,
                    non-revoked consent grant.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setAccessResult(null)}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-colors"
                  >
                    Acknowledge & Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: REQUEST CONSENT ACCESS */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Request Patient Consent
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Requesting access to {selectedPatient.fullName}&apos;s medical vault.
                </p>
              </div>
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Clinical Rationale / Purpose
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cardiology Second Opinion & Stress Test Review"
                  value={requestPurpose}
                  onChange={(e) => setRequestPurpose(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Physician Clinical Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Additional context for the patient..."
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Requested Access Window
                </label>
                <select
                  value={requestHours}
                  onChange={(e) => setRequestHours(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>1 Hour (Urgent Consult)</option>
                  <option value={24}>24 Hours (Standard Outpatient)</option>
                  <option value={72}>72 Hours (Comprehensive Workup)</option>
                  <option value={168}>7 Days (Multi-specialty Panel)</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition-colors"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

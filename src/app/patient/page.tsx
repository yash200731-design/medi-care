'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  ShieldCheck,
  Clock,
  Ban,
  CheckCircle2,
  PlusCircle,
  Copy,
  Check,
  Eye,
  Calendar,
  ExternalLink,
  Lock,
  Stethoscope,
  Info,
  X,
  Sparkles,
} from 'lucide-react';
import { DemoStore, computeSha256 } from '@/lib/store/demo-store';
import { MedicalRecord, ConsentGrant, AccessRequest, RecordCategory } from '@/types';
import { DEMO_PATIENTS } from '@/lib/mock-data';

export default function PatientDashboard() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'records' | 'grants' | 'requests'>('records');

  // State
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [grants, setGrants] = useState<ConsentGrant[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewRecord, setPreviewRecord] = useState<MedicalRecord | null>(null);
  const [approveRequestTarget, setApproveRequestTarget] = useState<AccessRequest | null>(null);
  const [grantDuration, setGrantDuration] = useState<number>(24);

  // Form State for New Record
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<RecordCategory>('Lab Report');
  const [newDescription, setNewDescription] = useState('');
  const [newContent, setNewContent] = useState('');
  const [liveCalculatedSha, setLiveCalculatedSha] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const currentUser = DemoStore.getCurrentUser();
  const currentPatient =
    currentUser.role === 'patient'
      ? currentUser
      : DEMO_PATIENTS[0]; // Fallback to Sarah Chen

  const refreshData = () => {
    const allRecords = DemoStore.getRecords().filter((r) => r.patientId === currentPatient.id);
    const allGrants = DemoStore.getGrants().filter((g) => g.patientId === currentPatient.id);
    const allRequests = DemoStore.getRequests().filter((r) => r.patientId === currentPatient.id);

    setRecords(allRecords);
    setGrants(allGrants);
    setRequests(allRequests);
  };

  useEffect(() => {
    setMounted(true);
    refreshData();
  }, [currentPatient.id]);

  // Compute live hash as user types content
  useEffect(() => {
    if (newContent.trim().length > 0) {
      computeSha256(newContent).then((hash) => setLiveCalculatedSha(hash));
    } else {
      setLiveCalculatedSha('');
    }
  }, [newContent]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleUploadRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setIsUploading(true);
    try {
      const sha256 = await computeSha256(newContent);

      const added = DemoStore.addRecord({
        patientId: currentPatient.id,
        patientName: currentPatient.fullName,
        title: newTitle,
        category: newCategory,
        description: newDescription,
        storagePath: `${currentPatient.id}/${Date.now()}-${newTitle.toLowerCase().replace(/\s+/g, '_')}.pdf`,
        fileName: `${newTitle.replace(/\s+/g, '_')}.pdf`,
        fileSize: new Blob([newContent]).size,
        mimeType: 'application/pdf',
        documentSha256: sha256,
        contentPreview: newContent,
      });

      refreshData();
      setIsUploadOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewContent('');
      setLiveCalculatedSha('');

      setActionSuccessMsg(`Record "${added.title}" uploaded! SHA-256 anchored to blockchain ledger.`);
      setTimeout(() => setActionSuccessMsg(null), 5000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRevoke = (grantId: string) => {
    if (confirm('Immediately revoke access for this physician? All subsequent protected requests will be denied with HTTP 403.')) {
      DemoStore.revokeConsent(grantId);
      refreshData();
      setActionSuccessMsg('Access grant revoked immediately on blockchain ledger.');
      setTimeout(() => setActionSuccessMsg(null), 5000);
    }
  };

  const handleApprove = () => {
    if (!approveRequestTarget) return;

    DemoStore.grantConsent({
      requestId: approveRequestTarget.id,
      patientId: currentPatient.id,
      doctorId: approveRequestTarget.doctorId,
      durationHours: grantDuration,
    });

    refreshData();
    setApproveRequestTarget(null);
    setActionSuccessMsg(`Consent granted for ${grantDuration} hours. Anchored on-chain.`);
    setTimeout(() => setActionSuccessMsg(null), 5000);
  };

  if (!mounted) {
    return <div className="p-8 text-center text-slate-500">Loading Patient Vault...</div>;
  }

  // Active Grants calculation
  const activeGrantsList = grants.filter(
    (g) => !g.isRevoked && new Date(g.expiresAt).getTime() > Date.now()
  );
  const pendingRequestsList = requests.filter((r) => r.status === 'pending');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Alert Notification */}
      {actionSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold">{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)}>
            <X className="h-4 w-4 text-emerald-600" />
          </button>
        </div>
      )}

      {/* Header Profile Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-teal-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 text-xs font-semibold border border-blue-400/30">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Sovereign Patient EHR Vault</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome, {currentPatient.fullName}
          </h1>
          <p className="text-sm text-blue-100/90 max-w-xl">
            You maintain cryptographic ownership of all your medical records. No healthcare provider
            can access or decrypt your records without an active, unexpired consent grant.
          </p>
        </div>

        <button
          onClick={() => setIsUploadOpen(true)}
          className="inline-flex items-center space-x-2 px-5 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm shadow-md transition-all shrink-0 hover:scale-[1.02]"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Upload Medical Record</span>
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-1">
          <div className="text-xs font-medium text-slate-500 flex items-center space-x-1.5">
            <FileText className="h-4 w-4 text-blue-600" />
            <span>Medical Records</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{records.length}</div>
          <div className="text-[11px] text-slate-400">Encrypted in private storage</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-1">
          <div className="text-xs font-medium text-slate-500 flex items-center space-x-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Active Doctor Grants</span>
          </div>
          <div className="text-2xl font-black text-emerald-600">{activeGrantsList.length}</div>
          <div className="text-[11px] text-slate-400">Time-window active</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-1">
          <div className="text-xs font-medium text-slate-500 flex items-center space-x-1.5">
            <Clock className="h-4 w-4 text-amber-600" />
            <span>Pending Requests</span>
          </div>
          <div className="text-2xl font-black text-amber-600">{pendingRequestsList.length}</div>
          <div className="text-[11px] text-slate-400">Awaiting your authorization</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-1">
          <div className="text-xs font-medium text-slate-500 flex items-center space-x-1.5">
            <ShieldCheck className="h-4 w-4 text-purple-600" />
            <span>On-Chain Anchors</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{records.length + grants.length}</div>
          <div className="text-[11px] text-slate-400">SHA-256 integrity proofs</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('records')}
            className={`pb-4 text-sm font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'records'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>My Medical Records ({records.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('grants')}
            className={`pb-4 text-sm font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'grants'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="h-4 w-4" />
            <span>Consent Grants & Expirations ({grants.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`pb-4 text-sm font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'requests'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Stethoscope className="h-4 w-4" />
            <span>Incoming Doctor Requests ({pendingRequestsList.length})</span>
          </button>
        </nav>
      </div>

      {/* TAB 1: MEDICAL RECORDS */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Encrypted Clinical Records</h2>
            <span className="text-xs text-slate-500">
              Files verified with SHA-256 cryptographic hashes
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {records.map((record) => (
              <div
                key={record.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:border-blue-200 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {record.category}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(record.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base leading-snug">
                    {record.title}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-2">
                    {record.description || 'Clinical observation and diagnostics documentation.'}
                  </p>

                  {/* SHA-256 Checksum Badge */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                      <span className="flex items-center space-x-1">
                        <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                        <span>SHA-256 Integrity Hash</span>
                      </span>
                      <button
                        onClick={() => handleCopy(record.documentSha256)}
                        className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 text-[10px]"
                      >
                        {copiedHash === record.documentSha256 ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span className="text-emerald-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="font-mono text-[10px] text-slate-700 truncate select-all">
                      {record.documentSha256}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="text-slate-400 text-[11px]">
                    {(record.fileSize / 1024 / 1024).toFixed(2)} MB &bull; PDF
                  </div>

                  <button
                    onClick={() => setPreviewRecord(record)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>View Record</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: CONSENT GRANTS */}
      {activeTab === 'grants' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Physician Consent Grants</h2>
            <span className="text-xs text-slate-500">
              Time-limited access policies with immediate revocation authority
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Authorized Physician</th>
                    <th className="py-3.5 px-4">Granted At</th>
                    <th className="py-3.5 px-4">Expiration Window</th>
                    <th className="py-3.5 px-4">Ledger Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {grants.map((grant) => {
                    const isExpired = new Date(grant.expiresAt).getTime() <= Date.now();
                    const isActive = !grant.isRevoked && !isExpired;

                    const remainingHours = Math.max(
                      0,
                      Math.round(
                        (new Date(grant.expiresAt).getTime() - Date.now()) / (1000 * 3600)
                      )
                    );

                    return (
                      <tr key={grant.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-4 px-4">
                          <div className="font-bold text-slate-900">{grant.doctorName}</div>
                          <div className="text-[11px] text-slate-500">{grant.doctorSpecialty}</div>
                        </td>

                        <td className="py-4 px-4 text-slate-600">
                          {new Date(grant.grantedAt).toLocaleString()}
                        </td>

                        <td className="py-4 px-4">
                          {grant.isRevoked ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <Ban className="h-3 w-3" />
                              <span>Revoked by Patient</span>
                            </span>
                          ) : isExpired ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="h-3 w-3" />
                              <span>Expired ({new Date(grant.expiresAt).toLocaleDateString()})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Clock className="h-3 w-3 animate-spin" />
                              <span>Active (~{remainingHours}h remaining)</span>
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-mono text-[10px] text-slate-500 truncate max-w-[140px]">
                            {grant.blockchainTxHash || 'Anchoring...'}
                          </div>
                        </td>

                        <td className="py-4 px-4 text-right">
                          {isActive && (
                            <button
                              onClick={() => handleRevoke(grant.id)}
                              className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 shadow-xs transition-colors inline-flex items-center space-x-1.5"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              <span>Revoke Immediately</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ACCESS REQUESTS */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Incoming Doctor Requests</h2>
            <span className="text-xs text-slate-500">
              Physicians requesting access to your clinical vault
            </span>
          </div>

          <div className="space-y-3">
            {requests.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400">
                No active access requests from physicians.
              </div>
            ) : (
              requests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <Stethoscope className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900">{req.doctorName}</div>
                        <div className="text-xs text-slate-500">
                          {req.doctorSpecialty} &bull; {req.doctorOrganization}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-700 space-y-1">
                      <div className="font-semibold text-slate-900">Clinical Purpose:</div>
                      <div>{req.purpose}</div>
                      {req.clinicalNotes && (
                        <div className="text-slate-500 text-[11px] italic">
                          &ldquo;{req.clinicalNotes}&rdquo;
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0">
                    {req.status === 'pending' ? (
                      <>
                        <button
                          onClick={() => setApproveRequestTarget(req)}
                          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Review & Approve Grant</span>
                        </button>
                      </>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold capitalize bg-slate-100 text-slate-600">
                        Status: {req.status}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD RECORD */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <PlusCircle className="h-5 w-5 text-teal-600" />
                  <span>Upload Medical Document</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Client-side hashing generates SHA-256 integrity proof prior to encryption.
                </p>
              </div>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUploadRecord} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Brain MRI T1/T2 Axial Scan with Contrast"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as RecordCategory)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Lab Report">Lab Report</option>
                    <option value="Imaging & Radiology">Imaging & Radiology</option>
                    <option value="Prescription">Prescription</option>
                    <option value="Clinical Note">Clinical Note</option>
                    <option value="Genomic & Cardiology">Genomic & Cardiology</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Storage Format
                  </label>
                  <input
                    type="text"
                    disabled
                    value="Encrypted PDF / DICOM"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Clinical Synopsis
                </label>
                <input
                  type="text"
                  placeholder="Indication, physician summary, or chief complaint"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Synthetic Medical Record Content
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Paste or simulate diagnostic text findings..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Live Hash Calculation */}
              {liveCalculatedSha && (
                <div className="bg-teal-50 border border-teal-200 p-3 rounded-xl space-y-1">
                  <div className="text-[11px] font-bold text-teal-800 flex items-center space-x-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                    <span>Real-Time SHA-256 Calculation:</span>
                  </div>
                  <div className="font-mono text-[10px] text-teal-950 break-all select-all">
                    {liveCalculatedSha}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md transition-colors"
                >
                  {isUploading ? 'Anchoring...' : 'Sign & Anchor to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW RECORD PREVIEW */}
      {previewRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  {previewRecord.category}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  {previewRecord.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewRecord(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Cryptographic Proof Status:</span>
                <span className="text-emerald-700 flex items-center space-x-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>On-Chain Verified</span>
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-600 break-all select-all">
                SHA-256: {previewRecord.documentSha256}
              </div>
              {previewRecord.blockchainTxHash && (
                <div className="text-[11px] font-mono text-slate-400 break-all">
                  Tx: {previewRecord.blockchainTxHash}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase">
                Decrypted Clinical Document Content:
              </h4>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {previewRecord.contentPreview || 'No preview text.'}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: APPROVE GRANT WITH TIME WINDOW */}
      {approveRequestTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Grant Time-Limited Access
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                You are approving access for {approveRequestTarget.doctorName}
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-100 text-blue-900">
                <span className="font-bold">Requested Reason:</span> {approveRequestTarget.purpose}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Select Grant Expiration Duration:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { hours: 1, label: '1 Hour' },
                    { hours: 6, label: '6 Hours' },
                    { hours: 24, label: '24 Hours' },
                    { hours: 168, label: '7 Days' },
                  ].map((opt) => (
                    <button
                      key={opt.hours}
                      type="button"
                      onClick={() => setGrantDuration(opt.hours)}
                      className={`py-2.5 rounded-xl border font-bold text-xs transition-all ${
                        grantDuration === opt.hours
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-[11px] text-slate-500 flex items-start space-x-2">
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <span>
                  Once this duration elapses, the backend will automatically block all further access attempts. You can also revoke access anytime with 1 click.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setApproveRequestTarget(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-colors"
              >
                Confirm Grant on Blockchain
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

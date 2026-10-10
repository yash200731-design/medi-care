'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  Clock,
  Ban,
  FileCheck2,
  FileText,
  Activity,
  ArrowRight,
  Stethoscope,
  User,
  History,
  CheckCircle2,
  XCircle,
  Database,
  ExternalLink,
} from 'lucide-react';
import { DemoStore } from '@/lib/store/demo-store';

export default function HomePage() {
  const handleSelectRole = (userId: string, targetPath: string) => {
    DemoStore.setCurrentUser(userId);
    window.location.href = targetPath;
  };

  return (
    <div className="space-y-20 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b border-slate-200/80 bg-radial from-blue-50/80 via-white to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-100/80 text-blue-800 text-xs font-semibold tracking-wide border border-blue-200 shadow-xs">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
              <span>Full-Stack Zero-Trust Healthcare EHR Architecture</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.15]">
              Patient-Controlled Medical Records,{' '}
              <span className="bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 bg-clip-text text-transparent">
                Cryptographically Sovereign.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 font-normal leading-relaxed">
              Patients own their records and issue granular, time-limited access grants to doctors.
              Expired and revoked grants are <span className="font-semibold text-slate-800">strictly denied at the backend</span>.
              Document SHA-256 integrity and consent proofs are immutably verified on Ethereum—
              <span className="font-semibold text-slate-800"> zero personal health data ever touches the blockchain.</span>
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link
                href="/patient"
                className="inline-flex items-center space-x-2.5 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 transition-all"
              >
                <User className="h-4 w-4" />
                <span>Launch Patient Vault</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/doctor"
                className="inline-flex items-center space-x-2.5 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm border border-slate-300 shadow-xs transition-all"
              >
                <Stethoscope className="h-4 w-4 text-blue-600" />
                <span>Doctor Clinical View</span>
              </Link>

              <Link
                href="/audit"
                className="inline-flex items-center space-x-2.5 px-6 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-all"
              >
                <History className="h-4 w-4 text-slate-500" />
                <span>Audit Explorer</span>
              </Link>
            </div>
          </div>

          {/* Quick-Test Interactive Sandbox Tray */}
          <div className="mt-16 bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-200/50 p-6 md:p-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-between pb-5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <span>Instant Test Scenarios (1-Click Switch)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pre-configured test personas demonstrating active, expired, and revoked zero-trust grant enforcement.
                </p>
              </div>
              <span className="hidden sm:inline-block px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
                Sandbox Mode Ready
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {/* Scenario 1: Active Grant */}
              <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 flex flex-col justify-between space-y-4 hover:border-emerald-300 transition-all">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
                    <span className="flex items-center space-x-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Active Grant (~20 hrs left)</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-200/60 text-emerald-900 text-[10px]">
                      HTTP 200
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mt-2">
                    Dr. Aris Thorne (Cardiologist)
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Patient Sarah Chen approved a 24-hour grant. Dr. Thorne can securely retrieve and decrypt her 3T Cardiac MRI.
                  </p>
                </div>
                <button
                  onClick={() => handleSelectRole('doctor-thorne-201', '/doctor')}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                >
                  <span>Test Dr. Thorne (Allowed)</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Scenario 2: Expired Grant */}
              <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-4 flex flex-col justify-between space-y-4 hover:border-amber-300 transition-all">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-800">
                    <span className="flex items-center space-x-1.5">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span>Expired Grant (Lapsed)</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-200/60 text-amber-900 text-[10px]">
                      HTTP 403
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mt-2">
                    Dr. Maya Patel (Neurology)
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Historical 1-hour consultation grant expired 9 days ago. Protected requests are strictly rejected at the server level.
                  </p>
                </div>
                <button
                  onClick={() => handleSelectRole('doctor-patel-202', '/doctor')}
                  className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                >
                  <span>Test Dr. Patel (Expired)</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Scenario 3: Revoked Grant */}
              <div className="border border-rose-200 bg-rose-50/40 rounded-xl p-4 flex flex-col justify-between space-y-4 hover:border-rose-300 transition-all">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-rose-800">
                    <span className="flex items-center space-x-1.5">
                      <Ban className="h-4 w-4 text-rose-600" />
                      <span>Revoked Consent</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-200/60 text-rose-900 text-[10px]">
                      HTTP 403
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mt-2">
                    Dr. Julian Vance (Oncology)
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Patient explicitly revoked consulting privileges. Immediate revocation was broadcast to ledger. File access denied.
                  </p>
                </div>
                <button
                  onClick={() => handleSelectRole('doctor-vance-203', '/doctor')}
                  className="w-full py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                >
                  <span>Test Dr. Vance (Revoked)</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Pillars Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
          <h2 className="text-xs font-bold text-blue-600 tracking-wider uppercase">
            Zero-Trust Architectural Model
          </h2>
          <h3 className="text-3xl font-extrabold text-slate-900">
            How MediVault Solves Healthcare Security
          </h3>
          <p className="text-sm text-slate-600">
            Protecting sensitive medical documents while establishing verifiable mathematical trust.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-4">
            <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Lock className="h-6 w-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900">Zero PHI / PII On-Chain</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Putting medical records or patient names on a public blockchain violates HIPAA and GDPR.
              MediVault only stores anonymized cryptographic keccak256 event digests and document SHA-256 hashes on Ethereum.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-4">
            <div className="h-12 w-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900">Server-Side Grant Enforcement</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Doctors cannot download medical files directly. Every file request queries the backend
              authorization gate (<code className="text-blue-700 bg-blue-50 px-1 py-0.5 rounded">/api/records/[id]/access</code>)
              which verifies an active, unexpired, non-revoked grant before issuing short-lived signed URLs.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileCheck2 className="h-6 w-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900">Immutable Document Integrity</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              When a medical document is uploaded, a SHA-256 hash is computed client-side and verified
              server-side. The hash is permanently registered in <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">MediVaultAudit.sol</code>,
              preventing silent data tampering.
            </p>
          </div>
        </div>
      </section>

      {/* Flowchart / Interactive Comparison */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 text-white rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-900/60 text-blue-300 text-xs font-semibold border border-blue-700">
              <Database className="h-3.5 w-3.5" />
              <span>Full-Stack Security Stack</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
              End-to-End Verification Pipeline
            </h3>

            <p className="text-sm text-slate-300 leading-relaxed">
              When Dr. Thorne requests access to Sarah Chen&apos;s Cardiac MRI:
            </p>

            <div className="space-y-3 pt-2 text-xs">
              <div className="flex items-start space-x-3 bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
                <span className="font-bold text-blue-400 font-mono text-sm">01</span>
                <div>
                  <div className="font-bold text-white">Doctor Submits Access Request</div>
                  <div className="text-slate-400">Specifies clinical rationale, requested window (e.g. 24h), and credentials.</div>
                </div>
              </div>

              <div className="flex items-start space-x-3 bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
                <span className="font-bold text-teal-400 font-mono text-sm">02</span>
                <div>
                  <div className="font-bold text-white">Patient Evaluates & Grants Consent</div>
                  <div className="text-slate-400">Patient configures expiration. Event is recorded to Solidity smart contract on-chain.</div>
                </div>
              </div>

              <div className="flex items-start space-x-3 bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
                <span className="font-bold text-emerald-400 font-mono text-sm">03</span>
                <div>
                  <div className="font-bold text-white">Zero-Trust Protected Retrieval</div>
                  <div className="text-slate-400">Doctor clicks record: Backend checks active status. If valid, issues temporary signed URL. If expired/revoked, blocks with HTTP 403!</div>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap gap-4">
              <Link
                href="/patient"
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold text-xs transition-colors"
              >
                <span>Enter Patient Dashboard</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/audit"
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors"
              >
                <span>Inspect Audit Ledger</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

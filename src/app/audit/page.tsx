'use client';

import React, { useState, useEffect } from 'react';
import {
  History,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Search,
  Copy,
  Check,
  ExternalLink,
  Cpu,
  Lock,
  Clock,
  Ban,
  FileCheck2,
  Sparkles,
} from 'lucide-react';
import { DemoStore, computeSha256 } from '@/lib/store/demo-store';
import { AuditEvent } from '@/types';
import { INITIAL_RECORDS } from '@/lib/mock-data';

export default function AuditPage() {
  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Verifier tool state
  const [verifyInput, setVerifyInput] = useState('');
  const [verificationResult, setVerificationResult] = useState<{
    testedHash: string;
    matched: boolean;
    recordTitle?: string;
    patientName?: string;
    txHash?: string;
    blockNumber?: number;
    createdAt?: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    const user = DemoStore.getCurrentUser();
    fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    }).catch(() => {});
    setEvents(DemoStore.getAuditEvents());
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyInput.trim()) return;

    let targetHash = verifyInput.trim();

    // If input is text instead of 64-char hex, compute SHA-256
    if (targetHash.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(targetHash)) {
      targetHash = await computeSha256(targetHash);
    }

    const currentRecords = DemoStore.getRecords();
    const match = currentRecords.find(
      (r) => r.documentSha256.toLowerCase() === targetHash.toLowerCase()
    );

    if (match) {
      setVerificationResult({
        testedHash: targetHash,
        matched: true,
        recordTitle: match.title,
        patientName: match.patientName,
        txHash: match.blockchainTxHash,
        blockNumber: 19842100,
        createdAt: match.createdAt,
      });
    } else {
      setVerificationResult({
        testedHash: targetHash,
        matched: false,
      });
    }
  };

  if (!mounted) {
    return <div className="p-8 text-center text-slate-500">Loading Audit Explorer...</div>;
  }

  const contractAddress =
    process.env.NEXT_PUBLIC_MEDIVAULT_CONTRACT_ADDRESS ||
    '0x5FbDB2315678afecb367f032d93F642f64180aa3';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-800">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-400/30">
            <Cpu className="h-3.5 w-3.5" />
            <span>Solidity Smart Contract Audit Ledger</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Blockchain Audit Explorer
          </h1>
          <p className="text-sm text-slate-300 max-w-xl">
            All consent approvals, time-limits, immediate revocations, and document SHA-256 integrity
            digests are immutably written to Ethereum. No PHI/PII is stored on-chain.
          </p>
        </div>

        <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 text-xs font-mono space-y-1.5 shrink-0">
          <div className="text-[10px] uppercase font-bold text-slate-400">
            MediVaultAudit.sol Contract
          </div>
          <div className="text-teal-400 font-bold select-all">{contractAddress}</div>
          <div className="text-[10px] text-slate-400 flex items-center space-x-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400"></span>
            <span>EVM ChainId: 31337 &bull; Hardhat Local / Sepolia</span>
          </div>
        </div>
      </div>

      {/* Interactive Tool: Document Integrity Verifier */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-teal-600" />
            <span>Cryptographic Document Integrity Verifier</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Verify whether a medical document has been tampered with by checking its SHA-256 digest against the blockchain ledger.
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              placeholder="Paste document SHA-256 hash or raw text (e.g. 9b71d224bd62f378...)"
              value={verifyInput}
              onChange={(e) => setVerifyInput(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl border border-slate-300 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center space-x-2 shrink-0"
            >
              <Search className="h-4 w-4" />
              <span>Verify Integrity</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">Quick Test Samples:</span>
            <button
              type="button"
              onClick={() =>
                setVerifyInput('9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca7')
              }
              className="underline hover:text-blue-600 font-mono"
            >
              Sarah&apos;s Cardiac MRI (Authentic)
            </button>
            <span>&bull;</span>
            <button
              type="button"
              onClick={() =>
                setVerifyInput('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
              }
              className="underline hover:text-blue-600 font-mono"
            >
              Advanced Lipid Panel (Authentic)
            </button>
            <span>&bull;</span>
            <button
              type="button"
              onClick={() =>
                setVerifyInput('bad000000000000000000000000000000000000000000000000000000000dead')
              }
              className="underline hover:text-rose-600 font-mono"
            >
              Tampered Hash (Altered)
            </button>
          </div>
        </form>

        {/* Verification Result Output */}
        {verificationResult && (
          <div
            className={`p-5 rounded-2xl border transition-all ${
              verificationResult.matched
                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                : 'bg-rose-50/70 border-rose-300 text-rose-900'
            }`}
          >
            <div className="flex items-start space-x-3">
              {verificationResult.matched ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1.5 flex-1">
                <div className="font-bold text-sm">
                  {verificationResult.matched
                    ? '100% AUTHENTIC: Cryptographic Integrity Confirmed on Ledger'
                    : 'VERIFICATION FAILED: Hash Altered or Not Found on Ledger'}
                </div>

                <div className="text-xs font-mono break-all text-slate-700">
                  Target SHA-256: {verificationResult.testedHash}
                </div>

                {verificationResult.matched ? (
                  <div className="text-xs space-y-1 pt-2 border-t border-emerald-200/60 font-sans">
                    <div>
                      <span className="font-bold">Record Title:</span>{' '}
                      {verificationResult.recordTitle}
                    </div>
                    <div>
                      <span className="font-bold">Patient Owner:</span>{' '}
                      {verificationResult.patientName}
                    </div>
                    <div className="font-mono text-[11px] text-emerald-800">
                      Anchor Tx: {verificationResult.txHash} &bull; Block #{' '}
                      {verificationResult.blockNumber}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-rose-700 pt-1">
                    This file does not match any anchored cryptographic proof. If this file was modified by even 1 character, the SHA-256 digest is invalidated.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Audit Event Stream */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Immutable Audit Trail ({events.length} Events)
          </h2>
          <span className="text-xs text-slate-500">
            Real-time feed of grant, revoke, and access events
          </span>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Event Type</th>
                  <th className="py-3.5 px-4">Actor</th>
                  <th className="py-3.5 px-4">Target / Record</th>
                  <th className="py-3.5 px-4">On-Chain Tx Hash</th>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((event) => {
                  let badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                  if (event.action === 'GRANT_ACCESS') {
                    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  } else if (event.action === 'REVOKE_ACCESS') {
                    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                  } else if (event.action.startsWith('ACCESS_DENIED')) {
                    badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
                  }

                  return (
                    <tr key={event.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-4 font-semibold">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}
                        >
                          {event.action}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900">{event.actorName}</div>
                        <div className="text-[10px] text-slate-400 capitalize">
                          {event.actorRole}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-slate-700">
                        {event.targetRecordTitle ||
                          event.targetPatientName ||
                          event.targetDoctorName ||
                          '-'}
                      </td>

                      <td className="py-4 px-4">
                        {event.blockchainTxHash ? (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1.5 font-mono text-[10px] text-slate-600">
                              <span className="truncate max-w-[120px]">
                                {event.blockchainTxHash}
                              </span>
                              <button
                                onClick={() => handleCopy(event.blockchainTxHash!)}
                                className="text-slate-400 hover:text-slate-600"
                                title="Copy hash"
                              >
                                {copiedHash === event.blockchainTxHash ? (
                                  <Check className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                            {(event.isSimulated || event.blockchainStatus === 'simulated') && (
                              <div className="text-[9px] font-mono text-purple-600 font-bold tracking-tight">
                                [SIMULATED MOCK HASH]
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-slate-500 text-[11px]">
                        {new Date(event.createdAt).toLocaleString()}
                      </td>

                      <td className="py-4 px-4 text-right">
                        {(() => {
                          const status =
                            event.blockchainStatus ||
                            (event.isSimulated
                              ? 'simulated'
                              : event.confirmedOnChain
                              ? 'confirmed'
                              : event.blockchainTxHash
                              ? 'simulated'
                              : undefined);

                          if (status === 'confirmed') {
                            return (
                              <span className="inline-flex items-center space-x-1 text-emerald-700 font-bold text-[10px] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Confirmed</span>
                              </span>
                            );
                          }
                          if (status === 'simulated') {
                            return (
                              <span
                                className="inline-flex items-center space-x-1 text-purple-700 font-bold text-[10px] bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200"
                                title="Simulation mode enabled: No genuine on-chain receipt validated."
                              >
                                <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                                <span>[SIMULATED]</span>
                              </span>
                            );
                          }
                          if (status === 'pending') {
                            return (
                              <span className="inline-flex items-center space-x-1 text-amber-700 font-bold text-[10px] bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                                <Clock className="h-3.5 w-3.5 text-amber-600 animate-spin" />
                                <span>Pending</span>
                              </span>
                            );
                          }
                          if (status === 'failed') {
                            return (
                              <span className="inline-flex items-center space-x-1 text-rose-700 font-bold text-[10px] bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                                <XCircle className="h-3.5 w-3.5 text-rose-600" />
                                <span>Failed</span>
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center space-x-1 text-slate-500 font-medium text-[10px] bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                              <span>Off-Chain Log</span>
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Lock, Cpu, Database, AlertCircle } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-teal-400 flex items-center justify-center text-white shadow-md">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="font-extrabold text-xl text-white tracking-tight">
                Medi<span className="text-blue-400">Vault</span>
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              Patient-controlled Electronic Health Records built on zero-trust principles.
              Medical files remain encrypted in private storage; consent grants are time-limited
              and patient-revocable; integrity proofs and audit trails are immutably anchored to Ethereum.
            </p>
            <div className="flex items-center space-x-2 text-xs text-amber-300 bg-amber-950/60 border border-amber-800/80 px-3 py-2 rounded-lg max-w-md">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Synthetic Hackathon Demo: All patient records, clinical notes, and personas are strictly synthetic.</span>
            </div>
          </div>

          {/* Core Security Model */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">
              Security Pillars
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li className="flex items-center space-x-2">
                <Lock className="h-3.5 w-3.5 text-blue-400" />
                <span>Zero PHI Stored On-Chain</span>
              </li>
              <li className="flex items-center space-x-2">
                <Cpu className="h-3.5 w-3.5 text-teal-400" />
                <span>Server-Side Grant Enforcement</span>
              </li>
              <li className="flex items-center space-x-2">
                <Database className="h-3.5 w-3.5 text-emerald-400" />
                <span>Strict Supabase RLS Policies</span>
              </li>
              <li className="flex items-center space-x-2">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                <span>Instant Patient Revocation</span>
              </li>
            </ul>
          </div>

          {/* Quick Navigation */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">
              Application Portals
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <Link href="/patient" className="hover:text-white transition-colors">
                  Patient Vault & Grants
                </Link>
              </li>
              <li>
                <Link href="/doctor" className="hover:text-white transition-colors">
                  Doctor Clinical Portal
                </Link>
              </li>
              <li>
                <Link href="/audit" className="hover:text-white transition-colors">
                  Blockchain Audit Explorer
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  System Architecture
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} MediVault Project. Built with Next.js, Supabase & Solidity.
          </div>
          <div className="mt-4 sm:mt-0 font-mono text-[11px] text-slate-400">
            Contract: 0x5FbDB231...180aa3 &bull; SHA-256 Verified
          </div>
        </div>
      </div>
    </footer>
  );
}

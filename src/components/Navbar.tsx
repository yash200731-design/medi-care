'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  User,
  Stethoscope,
  Activity,
  History,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { UserProfile } from '@/types';
import { DEMO_PATIENTS, DEMO_DOCTORS } from '@/lib/mock-data';

export default function Navbar() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEMO_PATIENTS[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [blockchainInfo, setBlockchainInfo] = useState<{
    simulated: boolean;
    network: string;
    latestBlock: number | null;
  }>({
    simulated: true,
    network: 'Simulation Mode',
    latestBlock: null,
  });
  const [persistenceMode, setPersistenceMode] = useState<string>('');

  useEffect(() => {
    setMounted(true);
    // Fetch active session from server
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.authenticated && data.user) {
          setCurrentUser(data.user);
        } else {
          // Initialize default demo session with Sarah Chen
          fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: DEMO_PATIENTS[0].id }),
          })
            .then((r) => r.json())
            .then((d) => {
              if (d && d.user) setCurrentUser(d.user);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});

    // Fetch live blockchain and persistence status
    fetch('/api/audit')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.blockchainStatus) {
          setBlockchainInfo(d.blockchainStatus);
        }
        if (d && d.persistence) {
          setPersistenceMode(d.persistence.label);
        }
      })
      .catch(() => {});
  }, []);

  const handleSwitchUser = async (userId: string) => {
    setIsDropdownOpen(false);
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data && data.user) {
        setCurrentUser(data.user);
      }
    } catch {}
    window.location.reload();
  };

  const handleReset = async () => {
    if (confirm('Reset active session to Sarah Chen (Patient)?')) {
      try {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: DEMO_PATIENTS[0].id }),
        });
      } catch {}
      window.location.reload();
    }
  };

  const navLinks = [
    { href: '/', label: 'Overview', icon: Activity },
    { href: '/patient', label: 'Patient Portal', icon: User },
    { href: '/doctor', label: 'Doctor Portal', icon: Stethoscope },
    { href: '/audit', label: 'Audit Explorer', icon: History },
  ];

  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold">
              MV
            </div>
            <span className="font-bold text-xl text-slate-900">MediVault</span>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-700 to-teal-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-xl tracking-tight text-slate-900">
                    Medi<span className="text-blue-600">Vault</span>
                  </span>
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-sm bg-teal-50 text-teal-700 border border-teal-200">
                    Zero-Trust EHR
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  Patient Sovereignty & Blockchain Audit
                </span>
              </div>
            </Link>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Side: Ledger Status & Role Switcher */}
          <div className="flex items-center space-x-3">
            {/* Persistence & Ledger Status Badges */}
            {persistenceMode && (
              <span className="hidden xl:inline-block px-2.5 py-1 text-[10px] font-semibold rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                {persistenceMode}
              </span>
            )}
            <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs">
              <span className="relative flex h-2 w-2">
                <span className={`relative inline-flex rounded-full h-2 w-2 ${blockchainInfo.simulated ? 'bg-purple-500' : 'bg-emerald-500'}`}></span>
              </span>
              <span className="text-slate-600 font-medium">
                {blockchainInfo.simulated ? 'Simulation Mode' : blockchainInfo.network}
              </span>
              {blockchainInfo.latestBlock !== null && (
                <span className="text-slate-400 font-mono text-[10px]">#{blockchainInfo.latestBlock}</span>
              )}
            </div>

            {/* Role Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`flex items-center space-x-2.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${
                  currentUser.role === 'patient'
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900 hover:bg-emerald-100/80'
                    : 'bg-blue-50/80 border-blue-200 text-blue-900 hover:bg-blue-100/80'
                }`}
              >
                <div
                  className={`h-7 w-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                    currentUser.role === 'patient'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {currentUser.role === 'patient' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Stethoscope className="h-4 w-4" />
                  )}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold leading-tight flex items-center space-x-1">
                    <span>{currentUser.fullName}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 capitalize">
                    {currentUser.role === 'patient' ? 'Patient (Owner)' : currentUser.specialty || 'Physician'}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400 ml-1" />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-50 text-slate-800">
                  <div className="px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Switch Active Persona (Sandbox)
                  </div>

                  <div className="py-1">
                    <div className="px-3 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50/50">
                      Patients (Record Owners)
                    </div>
                    {DEMO_PATIENTS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleSwitchUser(p.id)}
                        className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                          currentUser.id === p.id ? 'bg-emerald-50/80 font-bold text-emerald-900' : ''
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{p.fullName}</div>
                          <div className="text-[11px] text-slate-500">Vault with 3 records</div>
                        </div>
                        {currentUser.id === p.id && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        )}
                      </button>
                    ))}

                    <div className="px-3 py-1 mt-2 text-[11px] font-bold text-blue-700 bg-blue-50/50">
                      Physicians (Requesting Clinicians)
                    </div>
                    {DEMO_DOCTORS.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => handleSwitchUser(d.id)}
                        className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                          currentUser.id === d.id ? 'bg-blue-50/80 font-bold text-blue-900' : ''
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{d.fullName}</div>
                          <div className="text-[11px] text-slate-500">
                            {d.id === 'doctor-thorne-201' && 'Active Grant (Cardiology)'}
                            {d.id === 'doctor-patel-202' && 'Expired Grant (Neurology)'}
                            {d.id === 'doctor-vance-203' && 'Revoked Grant (Oncology)'}
                          </div>
                        </div>
                        {currentUser.id === d.id && (
                          <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 p-2">
                    <button
                      onClick={handleReset}
                      className="w-full flex items-center justify-center space-x-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reset Demo Sandbox State</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

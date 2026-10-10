/**
 * MediVault Phase 3 Verification Suite:
 * - Blockchain status representation (pending, confirmed, failed, simulated)
 * - Fake confirmation removal & real receipt requirement
 * - Explicit simulation mode labeling ([SIMULATED - NO ON-CHAIN RECEIPT])
 * - Immediate access revocation on protected requests
 * - Database migration (002_hardening.sql) zero-trust policy verification
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.TEST_APP_URL || 'http://localhost:3000';

async function getSessionToken(userId) {
  const res = await fetch(`${BASE_URL}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to establish session for ${userId}: ${res.status}`);
  }
  const data = await res.json();
  return { token: data.token, user: data.user };
}

async function runPhase3Tests() {
  console.log('=================================================================');
  console.log('MediVault Phase 3: Blockchain Integrity & DB Hardening Suite');
  console.log('=================================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Test ${total}: ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  const sarah = await getSessionToken('patient-sarah-101');
  const elena = await getSessionToken('patient-elena-103');
  const drThorne = await getSessionToken('doctor-thorne-201');
  const drPatel = await getSessionToken('doctor-patel-202');

  // --- SECTION 1: Blockchain Status Model & Fake Confirmation Elimination ---
  console.log('--- 1. Testing Blockchain Status Model & Fake Confirmation Removal ---');

  let createdGrantId = null;

  await test('Grant consent returns status: "simulated" with confirmed: false', async () => {
    const res = await fetch(`${BASE_URL}/api/consent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarah.token}`,
      },
      body: JSON.stringify({
        doctorId: drThorne.user.id,
        durationHours: 24,
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.grant && data.grant.id);
    createdGrantId = data.grant.id;

    assert.ok(data.blockchain, 'Response must include blockchain result');
    assert.strictEqual(
      data.blockchain.status,
      'simulated',
      'Blockchain status must be "simulated" when running in demo/simulation'
    );
    assert.strictEqual(
      data.blockchain.confirmed,
      false,
      'ZERO-TRUST: Simulation MUST NEVER claim confirmed: true without a verified block receipt'
    );
    assert.strictEqual(
      data.blockchain.isSimulated,
      true,
      'Simulation must explicitly flag isSimulated: true'
    );
    assert.ok(
      data.blockchain.label.includes('SIMULATED'),
      'Label must clearly identify "[SIMULATED - NO ON-CHAIN RECEIPT]"'
    );
  });

  await test('Medical Record upload anchors hash with status: "simulated" and confirmed: false', async () => {
    const res = await fetch(`${BASE_URL}/api/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarah.token}`,
      },
      body: JSON.stringify({
        title: 'Phase 3 Verification Molecular Oncology Profile',
        category: 'Lab Report',
        description: 'Hardening verification sample',
        content: 'BIO-REPORT-2026: KRAS G12C NEGATIVE, BRAF V600E NEGATIVE.',
        fileName: 'Molecular_Profile.pdf',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.record.documentSha256.length, 64);
    assert.strictEqual(data.blockchain.status, 'simulated');
    assert.strictEqual(data.blockchain.confirmed, false);
    assert.strictEqual(data.blockchain.isSimulated, true);
  });

  await test('Consent revocation anchors revocation event with status: "simulated" and confirmed: false', async () => {
    assert.ok(createdGrantId, 'Created grant ID should be present');
    const res = await fetch(`${BASE_URL}/api/consent?grantId=${createdGrantId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${sarah.token}`,
      },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.grant.isRevoked, true);
    assert.strictEqual(data.blockchain.status, 'simulated');
    assert.strictEqual(data.blockchain.confirmed, false);
    assert.strictEqual(data.blockchain.isSimulated, true);
  });

  // --- SECTION 2: API Protection & Authorization Enforcement ---
  console.log('\n--- 2. Testing API Protection & Immediate Revocation Enforcement ---');

  await test('Doctor attempting to create consent grant is denied with 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/api/consent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${drThorne.token}`,
      },
      body: JSON.stringify({
        doctorId: drThorne.user.id,
        patientId: sarah.user.id,
        durationHours: 24,
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await test('Patient attempting to revoke another patient grant is denied with 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/api/consent?grantId=grant-active-001`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${elena.token}`,
      },
    });
    assert.strictEqual(res.status, 403);
  });

  await test('Doctor accessing Sarah record after grant revocation is immediately denied with 403 Forbidden', async () => {
    // Attempt to access with Dr. Vance whose grant is revoked
    const drVance = await getSessionToken('doctor-vance-203');
    const res = await fetch(`${BASE_URL}/api/records/rec-cardiac-mri-001/access`, {
      headers: {
        Authorization: `Bearer ${drVance.token}`,
      },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.authorized, false);
    assert.strictEqual(data.error, 'ACCESS_DENIED_REVOKED');
  });

  await test('Doctor accessing Sarah record with expired grant is denied with 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/api/records/rec-cardiac-mri-001/access`, {
      headers: {
        Authorization: `Bearer ${drPatel.token}`,
      },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.authorized, false);
    assert.strictEqual(data.error, 'ACCESS_DENIED_EXPIRED');
  });

  await test('Audit trail endpoint returns logged events for authenticated user', async () => {
    const res = await fetch(`${BASE_URL}/api/audit`, {
      headers: {
        Authorization: `Bearer ${sarah.token}`,
      },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.events));
    assert.ok(data.events.length > 0);
  });

  // --- SECTION 3: Database Migration 002_hardening.sql Verification ---
  console.log('\n--- 3. Testing Database Migration 002_hardening.sql Specifications ---');

  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/002_hardening.sql');

  await test('Migration file 002_hardening.sql exists on disk', async () => {
    assert.ok(fs.existsSync(migrationPath), 'File 002_hardening.sql must exist');
  });

  const sql = fs.readFileSync(migrationPath, 'utf8');

  await test('002_hardening.sql implements prevent_role_escalation trigger to stop privilege tampering', async () => {
    assert.ok(
      sql.includes('CREATE OR REPLACE FUNCTION public.prevent_role_escalation()'),
      'Must define prevent_role_escalation function'
    );
    assert.ok(
      sql.includes('NEW.role IS DISTINCT FROM OLD.role'),
      'Must inspect NEW.role vs OLD.role'
    );
    assert.ok(
      sql.includes('CREATE TRIGGER trg_prevent_role_escalation'),
      'Must bind trigger on public.profiles'
    );
  });

  await test('002_hardening.sql restricts profile reading to legitimate directory or active grants', async () => {
    assert.ok(
      sql.includes("role = 'doctor'"),
      'Must allow browsing verified doctor directory'
    );
    assert.ok(
      sql.includes('cg.is_revoked = false') && sql.includes('cg.expires_at > now()'),
      'Doctors must only read patient profile with active unrevoked unexpired grant or request'
    );
  });

  await test('002_hardening.sql restricts medical_records INSERT to patient role', async () => {
    assert.ok(
      sql.includes('Patients can insert their own medical records') &&
        sql.includes("p.role = 'patient'"),
      'Only users with profile role = "patient" can insert records'
    );
  });

  await test('002_hardening.sql restricts consent_grants UPDATE strictly to revocation', async () => {
    assert.ok(
      sql.includes('Patients can only revoke active consent grants') &&
        sql.includes('is_revoked = true'),
      'Consent updates are limited to setting is_revoked = true'
    );
  });

  await test('002_hardening.sql enforces append-only immutability on audit trail (no UPDATE, no DELETE)', async () => {
    assert.ok(
      sql.includes('Audit trail is strictly append-only - No updates') &&
        sql.includes('USING (false)'),
      'Audit UPDATE denied with USING (false)'
    );
    assert.ok(
      sql.includes('Audit trail is strictly append-only - No deletes') &&
        sql.includes('USING (false)'),
      'Audit DELETE denied with USING (false)'
    );
  });

  // --- SUMMARY ---
  console.log('\n=================================================================');
  console.log(`Phase 3 Results: ${passed}/${total} tests passed successfully.`);
  console.log('=================================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runPhase3Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

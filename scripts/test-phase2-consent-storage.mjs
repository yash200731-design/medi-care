import assert from 'node:assert';

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

async function runPhase2Tests() {
  console.log('=================================================================');
  console.log('MediVault Phase 2: Authoritative DAL, Consent & Security Test Suite');
  console.log('=================================================================\n');

  // Clean test isolation: reset demo store to initial state
  await fetch(`${BASE_URL}/api/auth/session`, { method: 'DELETE' }).catch(() => {});

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
  const drVance = await getSessionToken('doctor-vance-203');

  // --- SECTION 1: Unauthenticated & Role Protection Tests ---
  console.log('--- 1. Testing Strict Authentication & Role Access Gating ---');

  await test('Unauthenticated GET /api/records is denied with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/records`);
    assert.strictEqual(res.status, 401);
  });

  await test('Unauthenticated POST /api/records is denied with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Record' }),
    });
    assert.strictEqual(res.status, 401);
  });

  await test('Unauthenticated GET /api/consent is denied with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/consent`);
    assert.strictEqual(res.status, 401);
  });

  await test('Unauthenticated POST /api/consent is denied with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorId: drThorne.user.id, durationHours: 24 }),
    });
    assert.strictEqual(res.status, 401);
  });

  await test('Unauthenticated GET /api/access-requests is denied with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/access-requests`);
    assert.strictEqual(res.status, 401);
  });

  await test('Doctor attempting to upload medical record to POST /api/records is denied with 403', async () => {
    const res = await fetch(`${BASE_URL}/api/records`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${drThorne.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Doctor Upload Attempt',
        category: 'Lab Report',
        contentPreview: 'Restricted',
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await test('Doctor attempting to issue consent grant on POST /api/consent is denied with 403', async () => {
    const res = await fetch(`${BASE_URL}/api/consent`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${drThorne.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doctorId: drPatel.user.id,
        durationHours: 24,
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await test('Patient attempting to submit access request on POST /api/access-requests is denied with 403', async () => {
    const res = await fetch(`${BASE_URL}/api/access-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sarah.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        patientId: elena.user.id,
        purpose: 'Unauthorized patient request',
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  // --- SECTION 2: Baseline Consent Verifications ---
  console.log('\n--- 2. Testing Authoritative Consent Gates on Existing Records ---');

  await test('Patient Sarah accessing her own record receives 200 and genuine signed URL', async () => {
    const res = await fetch(`${BASE_URL}/api/records/rec-cardiac-mri-001/access`, {
      headers: { Authorization: `Bearer ${sarah.token}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.authorized, true);
    assert.strictEqual(data.reason, 'PATIENT_OWNER');
    assert.ok(data.record.signedStorageUrl, 'Should return signedStorageUrl');
    assert.ok(data.record.signedStorageUrl.includes('sig='), 'URL must contain cryptographic signature');
    assert.ok(data.persistence, 'Response must include persistence metadata');
  });

  await test('Doctor Dr. Thorne with active grant receives 200 and genuine signed URL', async () => {
    const res = await fetch(`${BASE_URL}/api/records/rec-cardiac-mri-001/access`, {
      headers: { Authorization: `Bearer ${drThorne.token}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.authorized, true);
    assert.strictEqual(data.reason, 'ACTIVE_GRANT');
    assert.ok(data.record.signedStorageUrl);
  });

  await test('Doctor Dr. Patel with EXPIRED grant is denied with 403 (ACCESS_DENIED_EXPIRED)', async () => {
    const res = await fetch(`${BASE_URL}/api/records/rec-cardiac-mri-001/access`, {
      headers: { Authorization: `Bearer ${drPatel.token}` },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.authorized, false);
    assert.strictEqual(data.error, 'ACCESS_DENIED_EXPIRED');
  });

  await test('Doctor Dr. Vance with REVOKED grant is denied with 403 (ACCESS_DENIED_REVOKED)', async () => {
    const res = await fetch(`${BASE_URL}/api/records/rec-cardiac-mri-001/access`, {
      headers: { Authorization: `Bearer ${drVance.token}` },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.authorized, false);
    assert.strictEqual(data.error, 'ACCESS_DENIED_REVOKED');
  });

  await test('Cross-patient access attempt (Elena -> Sarah) is blocked with 403', async () => {
    const res = await fetch(`${BASE_URL}/api/records/rec-cardiac-mri-001/access`, {
      headers: { Authorization: `Bearer ${elena.token}` },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error, 'ACCESS_DENIED_UNAUTHORIZED');
  });

  // --- SECTION 3: End-to-End Dynamic Workflow (Upload -> Request -> Grant -> Access -> Revoke) ---
  console.log('\n--- 3. Testing Dynamic Workflow: Upload -> Request -> Grant -> Access -> Revoke ---');

  let newUploadedRecordId = '';
  const testDocHash = 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0';

  await test('Patient Sarah uploads new medical record via POST /api/records', async () => {
    const res = await fetch(`${BASE_URL}/api/records`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sarah.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Phase 2 Dynamic Genomic Panel',
        category: 'Genomic & Cardiology',
        description: 'Targeted genetic sequence analysis for pharmacogenomics',
        fileName: 'genomic_panel_2026.pdf',
        contentPreview: 'GENOMIC PROFILE: CYP2C19 extensive metabolizer genotype confirmed.',
        documentSha256: testDocHash,
      }),
    });

    assert.ok([200, 201].includes(res.status), `Expected 200 or 201, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.record.id);
    assert.strictEqual(data.record.patientId, sarah.user.id);
    assert.strictEqual(data.record.documentSha256, testDocHash);
    newUploadedRecordId = data.record.id;
  });

  await test('Doctor Dr. Vance CANNOT access the newly uploaded record with existing revoked status (403 ACCESS_DENIED_REVOKED / NO_GRANT)', async () => {
    const res = await fetch(`${BASE_URL}/api/records/${newUploadedRecordId}/access`, {
      headers: { Authorization: `Bearer ${drVance.token}` },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.authorized, false);
    assert.ok(data.error.includes('REVOKED') || data.error.includes('NO_GRANT'));
  });

  let newAccessRequestId = '';

  await test('Doctor Dr. Vance requests access to Sarah via POST /api/access-requests', async () => {
    const res = await fetch(`${BASE_URL}/api/access-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${drVance.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        patientId: sarah.user.id,
        purpose: 'Pharmacogenomics Consultation & Review',
        clinicalNotes: 'Evaluating drug-gene interactions for patient medication safety.',
        requestedDurationHours: 12,
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.request.patientId, sarah.user.id);
    assert.strictEqual(data.request.status, 'pending');
    newAccessRequestId = data.request.id;
  });

  await test('Patient Sarah views incoming request in GET /api/access-requests', async () => {
    const res = await fetch(`${BASE_URL}/api/access-requests`, {
      headers: { Authorization: `Bearer ${sarah.token}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    const found = data.requests.find((r) => r.id === newAccessRequestId);
    assert.ok(found, 'Request must be present in patient requests feed');
    assert.strictEqual(found.status, 'pending');
  });

  let createdGrantId = '';

  await test('Patient Sarah grants 12-hour consent to Dr. Vance via POST /api/consent', async () => {
    const res = await fetch(`${BASE_URL}/api/consent`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sarah.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestId: newAccessRequestId,
        doctorId: drVance.user.id,
        durationHours: 12,
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.grant.id);
    assert.strictEqual(data.grant.doctorId, drVance.user.id);
    assert.strictEqual(data.grant.patientId, sarah.user.id);
    createdGrantId = data.grant.id;
  });

  await test('Doctor Dr. Vance NOW successfully accesses the new record (HTTP 200 ACTIVE_GRANT)', async () => {
    const res = await fetch(`${BASE_URL}/api/records/${newUploadedRecordId}/access`, {
      headers: { Authorization: `Bearer ${drVance.token}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.authorized, true);
    assert.strictEqual(data.reason, 'ACTIVE_GRANT');
    assert.ok(data.record.signedStorageUrl, 'Doctor must receive signed URL');
  });

  await test('Patient Elena CANNOT revoke Sarah\'s grant (403 FORBIDDEN / 404)', async () => {
    const res = await fetch(`${BASE_URL}/api/consent?grantId=${createdGrantId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${elena.token}` },
    });
    assert.ok([403, 404].includes(res.status), `Expected 403 or 404, received ${res.status}`);
  });

  await test('Patient Sarah revokes Dr. Vance\'s grant via DELETE /api/consent', async () => {
    const res = await fetch(`${BASE_URL}/api/consent?grantId=${createdGrantId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sarah.token}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.grant.isRevoked, true);
  });

  await test('Doctor Dr. Vance is IMMEDIATELY blocked on the record with 403 (ACCESS_DENIED_REVOKED)', async () => {
    const res = await fetch(`${BASE_URL}/api/records/${newUploadedRecordId}/access`, {
      headers: { Authorization: `Bearer ${drVance.token}` },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.authorized, false);
    assert.strictEqual(data.error, 'ACCESS_DENIED_REVOKED');
  });

  // --- SECTION 4: Audit Verification & Document Integrity ---
  console.log('\n--- 4. Testing Audit Integrity & Document SHA-256 Verification ---');

  await test('GET /api/audit returns scoped audit trail without mock block numbers', async () => {
    const res = await fetch(`${BASE_URL}/api/audit`, {
      headers: { Authorization: `Bearer ${sarah.token}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.events));
    assert.ok(data.events.length > 0);
    // Verify blockchain status does not contain fake block numbers in simulation mode
    if (data.blockchainStatus.simulated) {
      assert.strictEqual(data.blockchainStatus.latestBlock, null, 'Must NOT display mock block number in simulation mode');
    }
  });

  await test('POST /api/audit verifies authentic SHA-256 hash of new record', async () => {
    const res = await fetch(`${BASE_URL}/api/audit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sarah.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documentSha256: testDocHash }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.verified, true);
    assert.strictEqual(data.title, 'Phase 2 Dynamic Genomic Panel');
    assert.strictEqual(data.status, 'AUTHENTIC & UNTAMPERED');
  });

  await test('POST /api/audit rejects tampered/unrecognized SHA-256 hash', async () => {
    const tamperedHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const res = await fetch(`${BASE_URL}/api/audit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sarah.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documentSha256: tamperedHash }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.verified, false);
    assert.strictEqual(data.status, 'NOT_FOUND_OR_ALTERED');
  });

  // --- SECTION 5: Private Storage Signed URL Boundaries ---
  console.log('\n--- 5. Testing Private Storage Signed URL Enforcement & Boundaries ---');

  // Obtain genuine signed URL for Sarah's Cardiac MRI
  const accessRes = await fetch(`${BASE_URL}/api/records/rec-cardiac-mri-001/access`, {
    headers: { Authorization: `Bearer ${sarah.token}` },
  });
  const accessData = await accessRes.json();
  const signedUrl = accessData.record.signedStorageUrl;

  await test('Authorized patient Sarah can download file via valid signed URL', async () => {
    const res = await fetch(signedUrl, {
      headers: { Authorization: `Bearer ${sarah.token}` },
    });
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('CLINICAL INDICATION') || text.includes('myocardium'), 'Should contain clinical document preview');
  });

  await test('Authorized doctor Dr. Thorne can download file via valid signed URL', async () => {
    const res = await fetch(signedUrl, {
      headers: { Authorization: `Bearer ${drThorne.token}` },
    });
    assert.strictEqual(res.status, 200);
  });

  await test('Cross-patient boundary: Elena CANNOT download Sarah\'s file via signed URL (403 Forbidden)', async () => {
    const res = await fetch(signedUrl, {
      headers: { Authorization: `Bearer ${elena.token}` },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error, 'ACCESS_DENIED_CROSS_PATIENT');
  });

  await test('Tampered storage URL (modified path) is rejected with 403 (INVALID_SIGNATURE)', async () => {
    const tamperedUrl = signedUrl.replace('cardiac-mri', 'tampered-record');
    const res = await fetch(tamperedUrl, {
      headers: { Authorization: `Bearer ${sarah.token}` },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error, 'INVALID_SIGNATURE');
  });

  await test('Expired storage URL is rejected with 403 (URL_EXPIRED)', async () => {
    const urlObj = new URL(signedUrl);
    urlObj.searchParams.set('expires', (Date.now() - 5000).toString());
    const res = await fetch(urlObj.toString(), {
      headers: { Authorization: `Bearer ${sarah.token}` },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error, 'URL_EXPIRED');
  });

  console.log(`\n=================================================================`);
  console.log(`Phase 2 Results: ${passed}/${total} security tests passed successfully.`);
  console.log(`=================================================================`);
}

runPhase2Tests().catch((err) => {
  console.error('Phase 2 test run failed:', err);
  process.exitCode = 1;
});

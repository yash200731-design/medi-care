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

async function runPhase1Tests() {
  console.log('=================================================================');
  console.log('MediVault Phase 1: Authentication & API Protection Verification');
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

  // --- SECTION 1: Unauthenticated Requests (Must Return 401) ---
  console.log('--- 1. Testing Unauthenticated Request Protections (401) ---');

  await test('GET /api/auth/session without token returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/session`);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, 'UNAUTHORIZED');
  });

  await test('GET /api/records without token returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/api/records`);
    assert.strictEqual(res.status, 401);
  });

  await test('POST /api/records without token returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/api/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', category: 'Lab Report', content: 'test' }),
    });
    assert.strictEqual(res.status, 401);
  });

  await test('GET /api/records/rec-cardiac-mri-001/access without token returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/api/records/rec-cardiac-mri-001/access`);
    assert.strictEqual(res.status, 401);
  });

  await test('GET /api/access-requests without token returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/api/access-requests`);
    assert.strictEqual(res.status, 401);
  });

  await test('POST /api/access-requests without token returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/api/access-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: 'patient-sarah-101', purpose: 'Consult' }),
    });
    assert.strictEqual(res.status, 401);
  });

  await test('GET /api/consent without token returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/api/consent`);
    assert.strictEqual(res.status, 401);
  });

  await test('POST /api/consent without token returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/api/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorId: 'doctor-thorne-201', durationHours: 24 }),
    });
    assert.strictEqual(res.status, 401);
  });

  await test('DELETE /api/consent without token returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/api/consent?grantId=grant-active-001`, {
      method: 'DELETE',
    });
    assert.strictEqual(res.status, 401);
  });

  await test('GET /api/audit without token returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/api/audit`);
    assert.strictEqual(res.status, 401);
  });

  // --- SECTION 2: Impersonation Protection & Header Bypass Prevention ---
  console.log('\n--- 2. Testing Impersonation Protection (Ignoring client headers) ---');

  await test('Sending x-viewer-id header without session is ignored and returns 401', async () => {
    const res = await fetch(`${BASE_URL}/api/records/rec-cardiac-mri-001/access`, {
      headers: { 'x-viewer-id': 'patient-sarah-101' },
    });
    assert.strictEqual(res.status, 401, 'Should reject unauthenticated request despite x-viewer-id');
  });

  await test('Sending viewerId query parameter without session is ignored and returns 401', async () => {
    const res = await fetch(`${BASE_URL}/api/records/rec-cardiac-mri-001/access?viewerId=doctor-thorne-201`);
    assert.strictEqual(res.status, 401);
  });

  await test('Tampered/Forged Bearer token returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/api/records/rec-cardiac-mri-001/access`, {
      headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwYXRpZW50LXNhcmFoLTEwMSJ9.fake_signature' },
    });
    assert.strictEqual(res.status, 401);
  });

  // --- SECTION 3: Authenticated Role & Cross-Patient Boundary Protections (403) ---
  console.log('\n--- 3. Testing Authenticated Authorization & Boundary Checks (403) ---');

  const sarah = await getSessionToken('patient-sarah-101');
  const elena = await getSessionToken('patient-elena-103');
  const drThorne = await getSessionToken('doctor-thorne-201');
  const drPatel = await getSessionToken('doctor-patel-202');
  const drVance = await getSessionToken('doctor-vance-203');

  await test('Patient Elena attempting to access Sarah Chen\'s file returns 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/api/records/rec-cardiac-mri-001/access`, {
      headers: { Authorization: `Bearer ${elena.token}` },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error, 'ACCESS_DENIED_UNAUTHORIZED');
  });

  await test('Patient Elena attempting to query Sarah Chen\'s records list returns 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/api/records?patientId=patient-sarah-101`, {
      headers: { Authorization: `Bearer ${elena.token}` },
    });
    assert.strictEqual(res.status, 403);
  });

  await test('Doctor Dr. Thorne attempting to upload a record returns 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/api/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${drThorne.token}`,
      },
      body: JSON.stringify({
        title: 'Doctor Upload Attempt',
        category: 'Lab Report',
        content: 'Unauthorized content',
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await test('Patient Sarah attempting to upload record with another patientId returns 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/api/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarah.token}`,
      },
      body: JSON.stringify({
        patientId: 'patient-elena-103', // Impersonation attempt
        title: 'Impersonated Upload',
        category: 'Lab Report',
        content: 'Sample text',
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await test('Patient Sarah attempting to create a doctor access request returns 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/api/access-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarah.token}`,
      },
      body: JSON.stringify({
        patientId: 'patient-sarah-101',
        purpose: 'Unauthorized patient-created doctor request',
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await test('Doctor Dr. Thorne attempting to approve/issue a consent grant returns 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/api/consent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${drThorne.token}`,
      },
      body: JSON.stringify({
        doctorId: 'doctor-thorne-201',
        durationHours: 24,
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await test('Patient Elena attempting to revoke Sarah\'s consent grant returns 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/api/consent?grantId=grant-active-001`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${elena.token}` },
    });
    assert.strictEqual(res.status, 403);
  });

  await test('Doctor Dr. Patel with EXPIRED grant returns 403 Forbidden (ACCESS_DENIED_EXPIRED)', async () => {
    const res = await fetch(`${BASE_URL}/api/records/rec-cardiac-mri-001/access`, {
      headers: { Authorization: `Bearer ${drPatel.token}` },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error, 'ACCESS_DENIED_EXPIRED');
  });

  await test('Doctor Dr. Vance with REVOKED grant returns 403 Forbidden (ACCESS_DENIED_REVOKED)', async () => {
    const res = await fetch(`${BASE_URL}/api/records/rec-cardiac-mri-001/access`, {
      headers: { Authorization: `Bearer ${drVance.token}` },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error, 'ACCESS_DENIED_REVOKED');
  });

  // --- SECTION 4: Legitimate Authorized Flows (200 OK) ---
  console.log('\n--- 4. Testing Authorized Access (200 OK) ---');

  await test('Patient Sarah Chen accessing her own record returns 200 OK (PATIENT_OWNER)', async () => {
    const res = await fetch(`${BASE_URL}/api/records/rec-cardiac-mri-001/access`, {
      headers: { Authorization: `Bearer ${sarah.token}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.authorized, true);
    assert.strictEqual(data.reason, 'PATIENT_OWNER');
  });

  await test('Doctor Dr. Thorne with ACTIVE grant accessing Sarah\'s record returns 200 OK (ACTIVE_GRANT)', async () => {
    const res = await fetch(`${BASE_URL}/api/records/rec-cardiac-mri-001/access`, {
      headers: { Authorization: `Bearer ${drThorne.token}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.authorized, true);
    assert.strictEqual(data.reason, 'ACTIVE_GRANT');
  });

  console.log(`\n=================================================================`);
  console.log(`Phase 1 Results: ${passed}/${total} security tests passed successfully.`);
  console.log(`=================================================================`);
}

runPhase1Tests().catch((err) => {
  console.error('Test run failed:', err);
  process.exitCode = 1;
});

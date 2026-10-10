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
  console.log('MediVault Phase 2: Consent as Source of Truth & Private Storage');
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
  const drVance = await getSessionToken('doctor-vance-203');

  // --- SECTION 1: Consent Verification on Protected Requests ---
  console.log('--- 1. Testing Consent Grant Verifications as Source of Truth ---');

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

  // --- SECTION 2: Private Storage Signed URL Security & Download Boundary ---
  console.log('\n--- 2. Testing Private Storage Signed URL Enforcement & Boundaries ---');

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
    // Set expiration in past
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

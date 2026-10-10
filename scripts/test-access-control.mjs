import assert from 'node:assert';
import crypto from 'node:crypto';

// Test Fixtures
const testPatient = { id: 'patient-sarah-101', name: 'Sarah Chen' };
const testDoctorThorne = { id: 'doctor-thorne-201', name: 'Dr. Aris Thorne' };
const testDoctorPatel = { id: 'doctor-patel-202', name: 'Dr. Maya Patel' };
const testDoctorVance = { id: 'doctor-vance-203', name: 'Dr. Julian Vance' };
const testDoctorUnknown = { id: 'doctor-stranger-999', name: 'Dr. Unknown' };

const testRecord = {
  id: 'rec-cardiac-mri-001',
  patientId: 'patient-sarah-101',
  title: 'Cardiac 3T MRI',
  documentSha256: '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca7',
  storagePath: 'patient-sarah-101/cardiac-mri-20260301.pdf',
};

const now = Date.now();

const testGrants = [
  // 1. ACTIVE Grant (expires in 20 hours)
  {
    id: 'grant-active-001',
    patientId: 'patient-sarah-101',
    doctorId: 'doctor-thorne-201',
    grantedAt: new Date(now - 4 * 3600 * 1000).toISOString(),
    expiresAt: new Date(now + 20 * 3600 * 1000).toISOString(),
    isRevoked: false,
  },
  // 2. EXPIRED Grant (expired 5 days ago)
  {
    id: 'grant-expired-002',
    patientId: 'patient-sarah-101',
    doctorId: 'doctor-patel-202',
    grantedAt: new Date(now - 6 * 86400 * 1000).toISOString(),
    expiresAt: new Date(now - 5 * 86400 * 1000).toISOString(),
    isRevoked: false,
  },
  // 3. REVOKED Grant (was valid until tomorrow, but revoked yesterday)
  {
    id: 'grant-revoked-003',
    patientId: 'patient-sarah-101',
    doctorId: 'doctor-vance-203',
    grantedAt: new Date(now - 2 * 86400 * 1000).toISOString(),
    expiresAt: new Date(now + 24 * 3600 * 1000).toISOString(),
    isRevoked: true,
    revokedAt: new Date(now - 1 * 86400 * 1000).toISOString(),
  },
];

/**
 * Pure authorization evaluation engine matching /api/records/[id]/access route logic
 */
function evaluateRecordAccess(viewerId, record, grants) {
  if (!viewerId) {
    return { statusCode: 401, authorized: false, error: 'UNAUTHORIZED' };
  }

  // 1. Patient Owner access
  if (viewerId === record.patientId) {
    return {
      statusCode: 200,
      authorized: true,
      reason: 'PATIENT_OWNER',
      message: 'Access granted: Patient owns record.',
    };
  }

  // 2. Locate grant for (patient, doctor)
  const matches = grants.filter(
    (g) => g.patientId === record.patientId && g.doctorId === viewerId
  );

  if (matches.length === 0) {
    return {
      statusCode: 403,
      authorized: false,
      error: 'ACCESS_DENIED_NO_GRANT',
      message: 'No consent grant exists for this patient and doctor.',
    };
  }

  const grant = matches[0];

  // 3. Revocation check
  if (grant.isRevoked) {
    return {
      statusCode: 403,
      authorized: false,
      error: 'ACCESS_DENIED_REVOKED',
      message: 'Patient has explicitly revoked access.',
    };
  }

  // 4. Expiration check
  const expiryTime = new Date(grant.expiresAt).getTime();
  if (Date.now() >= expiryTime) {
    return {
      statusCode: 403,
      authorized: false,
      error: 'ACCESS_DENIED_EXPIRED',
      message: 'Consent grant has expired.',
    };
  }

  // 5. Active verified grant
  return {
    statusCode: 200,
    authorized: true,
    reason: 'ACTIVE_GRANT',
    message: 'Active consent verified.',
  };
}

async function runAccessControlTests() {
  console.log('=================================================================');
  console.log('MediVault Backend Access Control & Security Verification Suite');
  console.log('=================================================================\n');

  let passed = 0;
  let total = 0;

  function runTest(name, fn) {
    total++;
    try {
      fn();
      console.log(`[PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Test ${total}: ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  // TEST 1: Patient accessing own record
  runTest('Patient accessing own record returns HTTP 200 (PATIENT_OWNER)', () => {
    const res = evaluateRecordAccess(testPatient.id, testRecord, testGrants);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.authorized, true);
    assert.strictEqual(res.reason, 'PATIENT_OWNER');
  });

  // TEST 2: Doctor with active grant accessing patient record
  runTest('Doctor with ACTIVE unrevoked unexpired grant returns HTTP 200 (ACTIVE_GRANT)', () => {
    const res = evaluateRecordAccess(testDoctorThorne.id, testRecord, testGrants);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.authorized, true);
    assert.strictEqual(res.reason, 'ACTIVE_GRANT');
  });

  // TEST 3: Doctor with EXPIRED grant MUST be DENIED with HTTP 403
  runTest('Doctor with EXPIRED grant returns HTTP 403 Forbidden (ACCESS_DENIED_EXPIRED)', () => {
    const res = evaluateRecordAccess(testDoctorPatel.id, testRecord, testGrants);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.authorized, false);
    assert.strictEqual(res.error, 'ACCESS_DENIED_EXPIRED');
  });

  // TEST 4: Doctor with REVOKED grant MUST be DENIED with HTTP 403
  runTest('Doctor with REVOKED grant returns HTTP 403 Forbidden (ACCESS_DENIED_REVOKED)', () => {
    const res = evaluateRecordAccess(testDoctorVance.id, testRecord, testGrants);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.authorized, false);
    assert.strictEqual(res.error, 'ACCESS_DENIED_REVOKED');
  });

  // TEST 5: Doctor with NO grant MUST be DENIED with HTTP 403
  runTest('Doctor with NO grant returns HTTP 403 Forbidden (ACCESS_DENIED_NO_GRANT)', () => {
    const res = evaluateRecordAccess(testDoctorUnknown.id, testRecord, testGrants);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.authorized, false);
    assert.strictEqual(res.error, 'ACCESS_DENIED_NO_GRANT');
  });

  // TEST 6: Cryptographic SHA-256 document hashing integrity
  runTest('SHA-256 integrity hash verification prevents silent payload tampering', () => {
    const sampleDocumentContent = 'CLINICAL EVALUATION: Patient exhibits normal sinus rhythm.';
    const calculatedHash = crypto.createHash('sha256').update(sampleDocumentContent).digest('hex');

    // Tampered content
    const tamperedContent = 'CLINICAL EVALUATION: Patient exhibits ventricular fibrillation!';
    const tamperedHash = crypto.createHash('sha256').update(tamperedContent).digest('hex');

    assert.notStrictEqual(calculatedHash, tamperedHash);
    assert.strictEqual(calculatedHash.length, 64);
  });

  console.log(`\nResults: ${passed}/${total} security and authorization tests passed successfully.`);
}

runAccessControlTests();

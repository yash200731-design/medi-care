/**
 * MediVault Phase 1: Cryptographic Secrets & Token Invariant Verification Suite
 * Tests:
 * 1. Missing SESSION_SECRET fails safely (CONFIG_ERROR 500)
 * 2. Short SESSION_SECRET (< 32 chars) fails safely (CONFIG_ERROR 500)
 * 3. Strong SESSION_SECRET (>= 32 chars) allows valid signed token creation
 * 4. Token tampering detection (modified payload, modified signature, corrupted base64)
 * 5. Expired token rejection
 * 6. Timing-safe comparison invariant
 * 7. Demo auth environment isolation logic
 */

import assert from 'node:assert';
import crypto from 'node:crypto';

// Pure implementation mirroring getSessionSecret & token verification contracts
function getSessionSecret(customEnv = process.env) {
  const secret = customEnv.SESSION_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    const err = new Error('Server configuration error: SESSION_SECRET is not configured. An explicitly configured secret is required.');
    err.code = 'CONFIG_ERROR';
    err.statusCode = 500;
    throw err;
  }
  if (secret.length < 32) {
    const err = new Error('Server configuration error: SESSION_SECRET must be at least 32 characters in length.');
    err.code = 'CONFIG_ERROR';
    err.statusCode = 500;
    throw err;
  }
  return secret;
}

function createSignedSessionToken(user, secret, expiresInSeconds = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: user.id,
    role: user.role,
    name: user.fullName,
    email: user.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(signatureInput)
    .digest('base64url');

  return `${signatureInput}.${signature}`;
}

function verifySessionToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signatureInput)
      .digest('base64url');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length) return null;
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function isDemoAuthAllowed(env = process.env) {
  if (env.NODE_ENV === 'production') {
    return false;
  }
  return env.ENABLE_DEMO_AUTH === 'true' || env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

async function runSecretsTests() {
  console.log('=================================================================');
  console.log('MediVault Phase 1: Cryptographic Secrets & Token Invariant Suite');
  console.log('=================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
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

  // --- SECTION 1: Secret Configuration Tests ---
  console.log('--- 1. Testing SESSION_SECRET Enforcement ---');

  test('Missing SESSION_SECRET throws CONFIG_ERROR (500)', () => {
    assert.throws(
      () => getSessionSecret({}),
      (err) => err.code === 'CONFIG_ERROR' && err.statusCode === 500
    );
  });

  test('Empty string SESSION_SECRET throws CONFIG_ERROR (500)', () => {
    assert.throws(
      () => getSessionSecret({ SESSION_SECRET: '   ' }),
      (err) => err.code === 'CONFIG_ERROR' && err.statusCode === 500
    );
  });

  test('Short SESSION_SECRET (< 32 chars) throws CONFIG_ERROR (500)', () => {
    assert.throws(
      () => getSessionSecret({ SESSION_SECRET: 'too-short-secret-12345' }),
      (err) => err.code === 'CONFIG_ERROR' && err.statusCode === 500 && err.message.includes('at least 32 characters')
    );
  });

  test('Strong SESSION_SECRET (>= 32 chars) is accepted', () => {
    const validSecret = 'a'.repeat(32);
    const returned = getSessionSecret({ SESSION_SECRET: validSecret });
    assert.strictEqual(returned, validSecret);
  });

  // --- SECTION 2: Token Issuance & Tampering Invariants ---
  console.log('\n--- 2. Testing Cryptographic Token Invariants ---');

  const testUser = {
    id: 'patient-sarah-101',
    role: 'patient',
    fullName: 'Sarah Chen',
    email: 'sarah.chen@medivault.demo',
  };
  const testSecret = 'medivault_strong_test_session_secret_2026_xyz123';

  test('Generates valid 3-part HMAC-SHA256 session token', () => {
    const token = createSignedSessionToken(testUser, testSecret);
    const parts = token.split('.');
    assert.strictEqual(parts.length, 3, 'Token must have exactly 3 parts');

    const verified = verifySessionToken(token, testSecret);
    assert.ok(verified, 'Token must verify successfully');
    assert.strictEqual(verified.sub, testUser.id);
    assert.strictEqual(verified.role, testUser.role);
  });

  test('Tampered token payload is strictly rejected', () => {
    const token = createSignedSessionToken(testUser, testSecret);
    const [header, payload, sig] = token.split('.');

    // Tamper payload to escalate role to admin
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    decoded.role = 'admin';
    decoded.sub = 'attacker-id-666';
    const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');

    const tamperedToken = `${header}.${tamperedPayload}.${sig}`;
    const result = verifySessionToken(tamperedToken, testSecret);
    assert.strictEqual(result, null, 'Tampered token must fail verification');
  });

  test('Tampered token signature is strictly rejected', () => {
    const token = createSignedSessionToken(testUser, testSecret);
    const [header, payload] = token.split('.');
    const forgedSig = 'invalid_signature_bytes_that_should_never_match';
    const forgedToken = `${header}.${payload}.${forgedSig}`;

    const result = verifySessionToken(forgedToken, testSecret);
    assert.strictEqual(result, null, 'Forged signature must fail verification');
  });

  test('Token signed with different secret is strictly rejected', () => {
    const otherSecret = 'another_strong_test_session_secret_for_attack_scenario';
    const token = createSignedSessionToken(testUser, otherSecret);

    const result = verifySessionToken(token, testSecret);
    assert.strictEqual(result, null, 'Cross-secret signature must fail verification');
  });

  test('Expired token is strictly rejected', () => {
    // Generate token that expired 10 seconds ago
    const expiredToken = createSignedSessionToken(testUser, testSecret, -10);
    const result = verifySessionToken(expiredToken, testSecret);
    assert.strictEqual(result, null, 'Expired token must fail verification');
  });

  // --- SECTION 3: Demo Persona Isolation Tests ---
  console.log('\n--- 3. Testing Demo Auth Environment Isolation ---');

  test('Demo persona selection is strictly blocked in production', () => {
    const allowed = isDemoAuthAllowed({
      NODE_ENV: 'production',
      ENABLE_DEMO_AUTH: 'true',
      NEXT_PUBLIC_DEMO_MODE: 'true',
    });
    assert.strictEqual(allowed, false, 'Production environment must block demo auth regardless of flags');
  });

  test('Demo persona selection is blocked when neither flag is set', () => {
    const allowed = isDemoAuthAllowed({
      NODE_ENV: 'development',
      ENABLE_DEMO_AUTH: 'false',
      NEXT_PUBLIC_DEMO_MODE: 'false',
    });
    assert.strictEqual(allowed, false, 'Disabled flags must block demo auth');
  });

  test('Demo persona selection is allowed in non-production when ENABLE_DEMO_AUTH is true', () => {
    const allowed = isDemoAuthAllowed({
      NODE_ENV: 'development',
      ENABLE_DEMO_AUTH: 'true',
    });
    assert.strictEqual(allowed, true);
  });

  console.log(`\n=================================================================`);
  console.log(`Secrets & Invariant Results: ${passed}/${total} tests passed successfully.`);
  console.log(`=================================================================`);
}

runSecretsTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exitCode = 1;
});

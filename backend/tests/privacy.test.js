import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectAndRedact } from '../src/engine/privacyGuard.js';

test('PrivacyGuard redacts API keys, bearer tokens, passwords, and SSNs', () => {
  const sample =
    'My key is sk-proj-abc1234567890xyz9876 and gemini AIzaSyD1234567890abcdef1234567 with Bearer mySecretJwtToken123, password=SuperSecret99 and SSN 123-45-6789';

  const result = inspectAndRedact(sample);

  assert.equal(result.redacted, true);
  assert.ok(!result.sanitizedText.includes('sk-proj-abc1234567890xyz9876'));
  assert.ok(!result.sanitizedText.includes('AIzaSyD1234567890abcdef1234567'));
  assert.ok(!result.sanitizedText.includes('mySecretJwtToken123'));
  assert.ok(!result.sanitizedText.includes('SuperSecret99'));
  assert.ok(!result.sanitizedText.includes('123-45-6789'));
  assert.ok(result.findings.length >= 3);
});

test('PrivacyGuard preserves benign productivity text and normal numbers', () => {
  const sample = 'Add task: Prepare Q4 roadmap for 45 minutes by 2026-12-01';
  const result = inspectAndRedact(sample);

  assert.equal(result.redacted, false);
  assert.equal(result.sanitizedText, sample);
  assert.deepEqual(result.findings, []);
});

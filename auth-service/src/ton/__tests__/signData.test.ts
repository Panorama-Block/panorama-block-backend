import test from 'node:test';
import assert from 'node:assert/strict';
import nacl from 'tweetnacl';
import { createTonSignDataHash, verifyTonSignature } from '../signData';

test('verifyTonSignature accepts a valid signData signature', () => {
  const address = `0:${'11'.repeat(32)}`;
  const payload = 'hello';
  const domain = 'example.com';
  const timestamp = 1700000000;

  const hash = createTonSignDataHash({
    address,
    payload,
    domain,
    timestamp,
    payloadMeta: { type: 'text', text: payload },
  });

  const seed = Uint8Array.from({ length: 32 }, (_, i) => i);
  const keyPair = nacl.sign.keyPair.fromSeed(seed);
  const signatureBytes = nacl.sign.detached(hash, keyPair.secretKey);

  const signature = Buffer.from(signatureBytes).toString('base64');
  const publicKey = Buffer.from(keyPair.publicKey).toString('hex');

  const ok = verifyTonSignature({
    payload,
    signature,
    publicKey,
    address,
    domain,
    timestamp,
    payloadMeta: { type: 'text', text: payload },
  });

  assert.equal(ok, true);
});

test('verifyTonSignature rejects invalid signature length', () => {
  const ok = verifyTonSignature({
    payload: 'x',
    signature: 'abcd',
    publicKey: 'deadbeef',
    address: `0:${'11'.repeat(32)}`,
    domain: 'example.com',
    timestamp: 1700000000,
  });

  assert.equal(ok, false);
});

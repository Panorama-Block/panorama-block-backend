import test from 'node:test';
import assert from 'node:assert/strict';
import nacl from 'tweetnacl';
import { createTonProofHash, verifyTonProofSignature } from '../tonProof';

test('verifyTonProofSignature accepts a valid tonProof signature', () => {
  const address = `0:${'22'.repeat(32)}`;
  const payload = 'proof-payload';
  const domain = 'example.com';
  const timestamp = 1700000000;

  const hash = createTonProofHash({
    address,
    payload,
    domain,
    timestamp,
  });

  const seed = Uint8Array.from({ length: 32 }, (_, i) => 255 - i);
  const keyPair = nacl.sign.keyPair.fromSeed(seed);
  const signatureBytes = nacl.sign.detached(hash, keyPair.secretKey);

  const signature = Buffer.from(signatureBytes).toString('base64');
  const publicKey = Buffer.from(keyPair.publicKey).toString('hex');

  const ok = verifyTonProofSignature({
    payload,
    signature,
    publicKey,
    address,
    domain,
    timestamp,
  });

  assert.equal(ok, true);
});

test('verifyTonProofSignature rejects invalid public key length', () => {
  const ok = verifyTonProofSignature({
    payload: 'x',
    signature: Buffer.alloc(64).toString('base64'),
    publicKey: 'deadbeef',
    address: `0:${'22'.repeat(32)}`,
    domain: 'example.com',
    timestamp: 1700000000,
  });

  assert.equal(ok, false);
});

import { createHash } from 'crypto';
import nacl from 'tweetnacl';
import { parseRawTonAddress } from './signData';

export type TonProofInput = {
  timestamp: string | number;
  domain: {
    lengthBytes: number;
    value: string;
  };
  signature: string;
  payload: string;
};

export function createTonProofHash(options: {
  address: string;
  payload: string;
  domain: string;
  timestamp: number;
}) {
  const { address, payload, domain, timestamp } = options;
  const { hash, wcBuffer } = parseRawTonAddress(address);

  const domainBuffer = Buffer.from(domain, 'utf8');
  const domainLenBuffer = Buffer.alloc(4);
  domainLenBuffer.writeUInt32LE(domainBuffer.length);

  const tsBuffer = Buffer.alloc(8);
  tsBuffer.writeBigUInt64LE(BigInt(timestamp));

  const payloadBuffer = Buffer.from(payload, 'utf8');

  const message = Buffer.concat([
    Buffer.from('ton-proof-item-v2/'),
    wcBuffer,
    hash,
    domainLenBuffer,
    domainBuffer,
    tsBuffer,
    payloadBuffer,
  ]);

  const messageHash = createHash('sha256').update(message).digest();
  const fullHash = createHash('sha256')
    .update(Buffer.concat([Buffer.from([0xff, 0xff]), Buffer.from('ton-connect'), messageHash]))
    .digest();

  return fullHash;
}

export function verifyTonProofSignature(options: {
  payload: string;
  signature: string;
  publicKey: string;
  address: string;
  domain: string;
  timestamp: number;
}) {
  const { payload, signature, publicKey, address, domain, timestamp } = options;
  const signatureBytes = Buffer.from(signature, 'base64');
  const cleanedPublicKey = publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey;
  const publicKeyBytes = Buffer.from(cleanedPublicKey, 'hex');
  if (publicKeyBytes.length !== 32 || signatureBytes.length !== 64) {
    return false;
  }

  const hash = createTonProofHash({ address, payload, domain, timestamp });
  return nacl.sign.detached.verify(hash, signatureBytes, publicKeyBytes);
}

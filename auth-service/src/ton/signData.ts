import { createHash } from 'crypto';
import nacl from 'tweetnacl';

export type SignDataPayloadVariant =
  | { type: 'text'; text: string }
  | { type: 'binary'; bytes: string }
  | { type: 'cell'; schema: string; cell: string };

export function parseRawTonAddress(address: string) {
  const [workchainRaw, hashHex] = address.split(':');
  if (!workchainRaw || !hashHex) {
    throw new Error('Invalid TON address');
  }
  const workchain = Number(workchainRaw);
  const hash = Buffer.from(hashHex, 'hex');
  if (!Number.isInteger(workchain) || hash.length !== 32) {
    throw new Error('Invalid TON address');
  }
  const wcBuffer = Buffer.alloc(4);
  wcBuffer.writeInt32BE(workchain);
  return { workchain, hash, wcBuffer };
}

export function createTonSignDataHash(options: {
  address: string;
  payload: string;
  domain: string;
  timestamp: number;
  payloadMeta?: SignDataPayloadVariant;
}) {
  const { address, payload, domain, timestamp, payloadMeta } = options;
  const { hash, wcBuffer } = parseRawTonAddress(address);

  const domainBuffer = Buffer.from(domain, 'utf8');
  const domainLenBuffer = Buffer.alloc(4);
  domainLenBuffer.writeUInt32BE(domainBuffer.length);

  const tsBuffer = Buffer.alloc(8);
  tsBuffer.writeBigUInt64BE(BigInt(timestamp));

  let payloadPrefix: Buffer;
  let payloadBuffer: Buffer;

  if (payloadMeta && payloadMeta.type === 'binary') {
    payloadPrefix = Buffer.from('bin');
    payloadBuffer = Buffer.from(payloadMeta.bytes || '', 'base64');
  } else {
    payloadPrefix = Buffer.from('txt');
    const textToUse =
      payloadMeta && payloadMeta.type === 'text'
        ? payloadMeta.text
        : payload;
    payloadBuffer = Buffer.from(textToUse, 'utf8');
  }
  const payloadLenBuffer = Buffer.alloc(4);
  payloadLenBuffer.writeUInt32BE(payloadBuffer.length);

  const message = Buffer.concat([
    Buffer.from([0xff, 0xff]),
    Buffer.from('ton-connect/sign-data/'),
    wcBuffer,
    hash,
    domainLenBuffer,
    domainBuffer,
    tsBuffer,
    payloadPrefix,
    payloadLenBuffer,
    payloadBuffer,
  ]);

  return createHash('sha256').update(message).digest();
}

export function verifyTonSignature(options: {
  payload: string;
  signature: string;
  publicKey: string;
  address: string;
  domain: string;
  timestamp: number;
  payloadMeta?: SignDataPayloadVariant;
}) {
  const { payload, signature, publicKey, address, domain, timestamp, payloadMeta } = options;
  const signatureBytes = Buffer.from(signature, 'base64');
  const cleanedPublicKey = publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey;
  const publicKeyBytes = Buffer.from(cleanedPublicKey, 'hex');
  if (publicKeyBytes.length !== 32 || signatureBytes.length !== 64) {
    return false;
  }

  const hash = createTonSignDataHash({ address, payload, domain, timestamp, payloadMeta });
  return nacl.sign.detached.verify(hash, signatureBytes, publicKeyBytes);
}

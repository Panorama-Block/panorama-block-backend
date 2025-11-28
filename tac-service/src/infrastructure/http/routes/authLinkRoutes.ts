import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import nacl from 'tweetnacl';
import { validationMiddleware } from '../middleware/validationMiddleware';
import { createRequestLogger } from '../../utils/logger';
import { DIContainer } from '../../di/container';

type SignDataPayloadVariant =
  | { type: 'text'; text: string }
  | { type: 'binary'; bytes: string }
  | { type: 'cell'; schema: string; cell: string };

const LinkTonSchema = z.object({
  telegramUserId: z.string().optional(),
  address: z.string().min(10, 'TON raw address required'),
  addressFriendly: z.string().optional(),
  payload: z.string().min(1),
  signature: z.string().min(1),
  publicKey: z.string().min(1),
  timestamp: z.number().int(),
  domain: z.string().min(1),
  payloadMeta: z.object({
    type: z.enum(['text', 'binary', 'cell']).optional(),
    text: z.string().optional(),
    bytes: z.string().optional(),
    schema: z.string().optional(),
    cell: z.string().optional()
  }).optional()
});

const EnsureEvmWalletSchema = z.object({
  telegramUserId: z.string().optional(),
  userId: z.string().optional(),
  tonAddress: z.string().optional(),
  chainId: z.string().min(1),
  address: z.string().min(1).optional(),
  provision: z.boolean().optional()
});

function parseRawTonAddress(address: string) {
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

function createTonSignDataHash(options: {
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

  const payloadType = payloadMeta?.type || 'text';
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
    payloadBuffer = Buffer.from(textToUse || payload, 'utf8');
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

  return message;
}

function verifyTonSignature(options: {
  address: string;
  payload: string;
  signature: string;
  publicKey: string;
  domain: string;
  timestamp: number;
  payloadMeta?: SignDataPayloadVariant;
}) {
  const { address, payload, signature, publicKey, domain, timestamp, payloadMeta } = options;
  const hash = createTonSignDataHash({ address, payload, domain, timestamp, payloadMeta });
  const signatureBytes = Buffer.from(signature, 'base64');
  const cleanedPublicKey = publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey;
  const publicKeyBytes = Buffer.from(cleanedPublicKey, 'hex');
  if (publicKeyBytes.length !== 32 || signatureBytes.length !== 64) {
    return false;
  }
  return nacl.sign.detached.verify(hash, signatureBytes, publicKeyBytes);
}

export function createAuthLinkRoutes(container: DIContainer): Router {
  const router = Router();
  const allowedDomains = (process.env.TON_ALLOWED_DOMAINS || '*')
    .split(',')
    .map(d => d.trim().toLowerCase());
  const maxSkewSeconds = Number(process.env.TON_AUTH_MAX_SKEW || 900); // 15m default

  // Public: Link TON wallet via TonConnect signData
  router.post(
    '/ton/link',
    validationMiddleware(LinkTonSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId || '', 'public');
      try {
        const {
          telegramUserId,
          address,
          addressFriendly,
          payload,
          signature,
          publicKey,
          timestamp,
          domain,
          payloadMeta
        } = req.body;

        const nowSec = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSec - timestamp) > maxSkewSeconds) {
          return res.status(400).json({ error: 'Timestamp outside allowed window' });
        }

        const normalizedDomain = (domain || '').toLowerCase();
        const domainAllowed = allowedDomains.includes('*') || allowedDomains.includes(normalizedDomain);
        if (!domainAllowed) {
          return res.status(400).json({ error: 'Domain not allowed' });
        }

        const isValid = verifyTonSignature({
          address,
          payload,
          signature,
          publicKey,
          domain: normalizedDomain,
          timestamp,
          payloadMeta
        });

        if (!isValid) {
          return res.status(401).json({ error: 'Invalid TON signature' });
        }

        const prisma = container.database;
        let userId: string | null = null;

        if (telegramUserId) {
          const user = await prisma.user.upsert({
            where: { telegramUserId },
            create: { telegramUserId },
            update: {}
          });
          userId = user.id;
        }

        const existingWallet = await prisma.tonWallet.findUnique({
          where: { tonAddressRaw: address }
        });

        if (existingWallet && userId && existingWallet.userId !== userId) {
          return res.status(409).json({ error: 'TON wallet already linked to another user' });
        }

        const userFromWallet = existingWallet
          ? await prisma.user.findUnique({ where: { id: existingWallet.userId } })
          : null;

        const resolvedUserId = userId || userFromWallet?.id || (await prisma.user.create({ data: {} })).id;

        const wallet = existingWallet
          ? await prisma.tonWallet.update({
              where: { id: existingWallet.id },
              data: {
                publicKey,
                tonAddressFriendly: addressFriendly || existingWallet.tonAddressFriendly,
                connectedAt: new Date()
              }
            })
          : await prisma.tonWallet.create({
              data: {
                userId: resolvedUserId,
                tonAddressRaw: address,
                tonAddressFriendly: addressFriendly,
                publicKey
              }
            });

        return res.json({
          success: true,
          data: {
            userId: resolvedUserId,
            tonAddressRaw: wallet.tonAddressRaw,
            publicKey: wallet.publicKey
          }
        });
      } catch (error: any) {
        requestLogger.error('Failed to link TON wallet', { error: error.message });
        next(error);
      }
    }
  );

  // Public/simple: ensure an EVM wallet record exists (smart wallet provisioning to be added)
  router.post(
    '/wallet/evm',
    validationMiddleware(EnsureEvmWalletSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      const requestLogger = createRequestLogger(req.traceId || '', 'public');
      try {
        const { telegramUserId, userId, tonAddress, chainId, provision } = req.body as z.infer<typeof EnsureEvmWalletSchema>;
        let { address } = req.body as z.infer<typeof EnsureEvmWalletSchema>;
        const prisma = container.database;

        let resolvedUserId = userId || null;

        // Allow resolving the user from an already-linked TON wallet when no explicit id is provided
        if (!resolvedUserId && tonAddress) {
          const tonWallet = await prisma.tonWallet.findUnique({
            where: { tonAddressRaw: tonAddress }
          });
          resolvedUserId = tonWallet?.userId || null;
        }

        if (telegramUserId) {
          const user = await prisma.user.upsert({
            where: { telegramUserId },
            create: { telegramUserId },
            update: {}
          });
          resolvedUserId = user.id;
        }

        if (!resolvedUserId) {
          return res.status(400).json({ error: 'userId or telegramUserId is required' });
        }

        // If tonAddress provided, ensure it belongs to the same user
        if (tonAddress) {
          const ton = await prisma.tonWallet.findUnique({ where: { tonAddressRaw: tonAddress } });
          if (ton && ton.userId !== resolvedUserId) {
            return res.status(409).json({ error: 'TON wallet already linked to another user' });
          }
        }

        // Enforce single EVM wallet per user+chain
        const existingByUserChain = await prisma.evmWallet.findUnique({
          where: { userId_chainId: { userId: resolvedUserId, chainId } }
        });

        if (existingByUserChain && existingByUserChain.address !== address) {
          return res.json({
            success: true,
            data: {
              userId: resolvedUserId,
              chainId: existingByUserChain.chainId,
              address: existingByUserChain.address,
              note: 'Existing TAC receiver preserved for security'
            }
          });
        }

        // Provision a smart wallet if requested or if no address provided
        if (!address || provision) {
          let provisioned = false;
          const maxAttempts = 2;
          let lastError: any = null;

          for (let attempt = 1; attempt <= maxAttempts && !provisioned; attempt++) {
            try {
              const { createThirdwebClient } = await import('thirdweb');
              const { defineChain } = await import('thirdweb/chains');
              const { privateKeyToAccount, smartWallet } = await import('thirdweb/wallets');

              const secretKey = process.env.THIRDWEB_SECRET_KEY || process.env.THIRDWEB_SERVER_WALLET_PRIVATE_KEY;
              const clientId = process.env.THIRDWEB_CLIENT_ID;
              if (!secretKey && !clientId) {
                throw new Error('THIRDWEB_SECRET_KEY or THIRDWEB_CLIENT_ID is required to provision smart wallet');
              }

              const client = secretKey
                ? createThirdwebClient({ secretKey })
                : createThirdwebClient({ clientId: clientId! });

              // Personal account derived from server key to deploy smart wallet
              const personalAccount = privateKeyToAccount({
                client,
                privateKey: secretKey!
              });

              // TAC chain id from env; fallback to 1 (Ethereum) as placeholder
              const tacChainId = Number(process.env.TAC_CHAIN_ID_NUM || 1);
              const wallet = smartWallet({
                chain: defineChain(tacChainId),
                gasless: false
              });

              const smartAccount = await wallet.connect({
                client,
                personalAccount
              });

              address = smartAccount.address;
              provisioned = true;
              requestLogger.info('Provisioned TAC smart wallet via thirdweb', { address, chainId: tacChainId, attempt });
            } catch (err: any) {
              lastError = err;
              requestLogger.warn('Smart wallet provisioning attempt failed', { attempt, err: err.message });
            }
          }

          if (!provisioned) {
            requestLogger.error('Smart wallet provisioning failed, fallback to placeholder', { err: lastError?.message });
            if (!address) {
              const crypto = await import('crypto');
              const seed = tonAddress || userId || telegramUserId || 'tac-user';
              const hash = crypto.createHash('sha256').update(seed).digest('hex');
              address = `0x${hash.slice(0, 40)}`;
              requestLogger.warn('Auto-generated TAC receiver address (placeholder). Provision real smart wallet ASAP.', { address });
            }
          }
        }

        const wallet = await prisma.evmWallet.upsert({
          where: {
            chainId_address: {
              chainId,
              address
            }
          },
          create: { chainId, address, userId: resolvedUserId },
          update: { userId: resolvedUserId }
        });

        return res.json({
          success: true,
          data: {
            userId: resolvedUserId,
            chainId: wallet.chainId,
            address: wallet.address
          }
        });
      } catch (error: any) {
        requestLogger.error('Failed to ensure EVM wallet', { error: error.message });
        next(error);
      }
    }
  );

  return router;
}

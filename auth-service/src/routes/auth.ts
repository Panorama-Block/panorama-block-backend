import { Router, Request, Response, CookieOptions } from 'express';
import { RedisClientType } from 'redis';
import { randomBytes } from 'crypto';
import {
  verifySignature,
  generateToken,
  validateToken,
  generateLoginPayload,
  isAuthConfigured,
} from '../utils/thirdwebAuth';

const REFRESH_COOKIE_NAME = process.env.AUTH_REFRESH_COOKIE_NAME || 'panorama_refresh';
const REFRESH_TTL_SECONDS = Number(process.env.AUTH_REFRESH_TTL_SECONDS || 60 * 60 * 24 * 14); // default 14 days

const shouldForceSecureCookie =
  (process.env.AUTH_COOKIE_SECURE || '').toLowerCase() === 'true' ||
  (process.env.NODE_ENV || '').toLowerCase() === 'production';

const configuredSameSite = (process.env.AUTH_COOKIE_SAMESITE || '').toLowerCase() as
  | 'lax'
  | 'strict'
  | 'none'
  | '';

const resolveSameSite = (): 'lax' | 'strict' | 'none' => {
  if (configuredSameSite === 'lax' || configuredSameSite === 'strict') {
    return configuredSameSite;
  }
  if (configuredSameSite === 'none') {
    return shouldForceSecureCookie ? 'none' : 'lax';
  }
  return shouldForceSecureCookie ? 'none' : 'lax';
};

const buildCookieOptions = (overrides?: Partial<CookieOptions>): CookieOptions => {
  const base: CookieOptions = {
    httpOnly: true,
    secure: shouldForceSecureCookie,
    sameSite: resolveSameSite(),
    path: '/',
    maxAge: REFRESH_TTL_SECONDS * 1000,
  };

  const cookieDomain = process.env.AUTH_COOKIE_DOMAIN?.trim();
  if (cookieDomain) {
    base.domain = cookieDomain;
  }

  return { ...base, ...overrides };
};

const setRefreshCookie = (res: Response, sessionId: string) => {
  res.cookie(REFRESH_COOKIE_NAME, sessionId, buildCookieOptions());
};

const clearRefreshCookie = (res: Response) => {
  res.clearCookie(REFRESH_COOKIE_NAME, buildCookieOptions({ maxAge: 0 }));
};

const parseRefreshCookie = (req: Request): string | null => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const needle = `${REFRESH_COOKIE_NAME}=`;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(needle)) {
      return decodeURIComponent(trimmed.substring(needle.length));
    }
  }
  return null;
};

const createSessionId = () => randomBytes(32).toString('base64url');

export default function authRoutes(redisClient: RedisClientType) {
  const router = Router();

  // Login route - generates payload for wallet to sign
  router.post('/login', async (req: Request, res: Response) => {
    try {
      console.log('🔐 [AUTH LOGIN] Login request received');

      if (!isAuthConfigured()) {
        console.log('❌ [AUTH LOGIN] Auth service not configured');
        return res
          .status(503)
          .json({ error: 'Auth service not configured: missing AUTH_PRIVATE_KEY' });
      }

      const { address } = req.body;
      console.log('📝 [AUTH LOGIN] Address received:', address);

      if (!address) {
        console.log('❌ [AUTH LOGIN] Address not provided');
        return res.status(400).json({ error: 'Address not provided' });
      }

      // Generate a payload using ThirdWeb SDK
      console.log('⚙️ [AUTH LOGIN] Generating login payload for address:', address);
      const payload = await generateLoginPayload(address);
      console.log('✅ [AUTH LOGIN] Login payload generated successfully');

      res.status(200).json({ payload });
    } catch (error: any) {
      console.error('❌ [AUTH LOGIN] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Verify route - verifies signature and generates JWT
  router.post('/verify', async (req: Request, res: Response) => {
    try {
      console.log('🔍 [AUTH VERIFY] Verify request received');

      if (!isAuthConfigured()) {
        console.log('❌ [AUTH VERIFY] Auth service not configured');
        return res
          .status(503)
          .json({ error: 'Auth service not configured: missing AUTH_PRIVATE_KEY' });
      }

      const { payload, signature } = req.body;
      console.log('📝 [AUTH VERIFY] Payload and signature received');

      if (!payload || !signature) {
        console.log('❌ [AUTH VERIFY] Payload or signature not provided');
        return res.status(400).json({ error: 'Payload or signature not provided' });
      }

      // Verify the signature and obtain the user address
      console.log('🔐 [AUTH VERIFY] Verifying signature...');
      const address = await verifySignature(payload, signature);
      console.log('✅ [AUTH VERIFY] Signature verified for address:', address);

      // Generate a JWT token using the full login payload (payload + signature)
      console.log('🎫 [AUTH VERIFY] Generating JWT token...');
      const token = await generateToken({ payload, signature });
      console.log('✅ [AUTH VERIFY] JWT token generated successfully');

      // Create a session in Redis
      const sessionId = createSessionId();
      const sessionData = {
        userId: address,
        address,
        sessionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isValid: true,
        payload,
        signature,
      };

      console.log('💾 [AUTH VERIFY] Creating session in Redis:', sessionId);
      await redisClient.set(`session:${sessionId}`, JSON.stringify(sessionData), {
        EX: REFRESH_TTL_SECONDS,
      });
      console.log('✅ [AUTH VERIFY] Session created successfully');

      setRefreshCookie(res, sessionId);

      const response = {
        token,
        address,
        sessionId,
      };

      console.log('📤 [AUTH VERIFY] Sending response:', {
        tokenLength: token.length,
        address: address,
        sessionId: sessionId,
        tokenPreview: token.substring(0, 50) + '...',
      });

      return res.json(response);
    } catch (error: any) {
      console.error('❌ [AUTH VERIFY] Error:', error);
      clearRefreshCookie(res);
      return res.status(401).json({ error: error.message });
    }
  });

  // Validate token route - for internal services
  router.post('/validate', async (req: Request, res: Response) => {
    try {
      console.log('🔍 [AUTH VALIDATE] Token validation request received');

      if (!isAuthConfigured()) {
        console.log('❌ [AUTH VALIDATE] Auth service not configured');
        return res
          .status(503)
          .json({ error: 'Auth service not configured: missing AUTH_PRIVATE_KEY' });
      }

      const { token, sessionId } = req.body;
      console.log('📝 [AUTH VALIDATE] Token and sessionId received:', {
        tokenPresent: !!token,
        sessionIdPresent: !!sessionId,
      });

      if (!token) {
        console.log('❌ [AUTH VALIDATE] Token not provided');
        return res.status(400).json({ error: 'Token not provided' });
      }

      // Validate the JWT token and extract user/session info
      console.log('🔐 [AUTH VALIDATE] Validating JWT token...');
      const authData = await validateToken(token);
      console.log('✅ [AUTH VALIDATE] JWT token validated successfully');

      // If sessionId is provided, check if session is valid
      if (sessionId) {
        console.log('💾 [AUTH VALIDATE] Checking session validity:', sessionId);
        const sessionData = await redisClient.get(`session:${sessionId}`);

        if (!sessionData) {
          console.log('❌ [AUTH VALIDATE] Session not found:', sessionId);
          return res.status(401).json({ error: 'Session not found' });
        }

        const session = JSON.parse(sessionData);

        if (!session.isValid) {
          console.log('❌ [AUTH VALIDATE] Session is invalid:', sessionId);
          return res.status(401).json({ error: 'Session is invalid' });
        }

        console.log('✅ [AUTH VALIDATE] Session is valid:', sessionId);
      }

      console.log('✅ [AUTH VALIDATE] Token validation successful');
      return res.json({
        isValid: true,
        payload: authData,
      });
    } catch (error: any) {
      console.error('❌ [AUTH VALIDATE] Error:', error);
      return res.status(401).json({ error: error.message });
    }
  });

  // Logout route
  router.post('/logout', async (req: Request, res: Response) => {
    try {
      console.log('🚪 [AUTH LOGOUT] Logout request received');

      if (!isAuthConfigured()) {
        console.log('❌ [AUTH LOGOUT] Auth service not configured');
        return res
          .status(503)
          .json({ error: 'Auth service not configured: missing AUTH_PRIVATE_KEY' });
      }

      const { sessionId } = req.body;
      console.log('📝 [AUTH LOGOUT] SessionId received:', sessionId);

      const refreshSessionId = sessionId || parseRefreshCookie(req);
      if (!refreshSessionId) {
        console.log('❌ [AUTH LOGOUT] Session ID not provided');
        clearRefreshCookie(res);
        return res.status(400).json({ error: 'Session ID not provided' });
      }

      console.log('💾 [AUTH LOGOUT] Checking session in Redis:', refreshSessionId);
      const sessionData = await redisClient.get(`session:${refreshSessionId}`);

      if (!sessionData) {
        console.log('❌ [AUTH LOGOUT] Session not found:', refreshSessionId);
        clearRefreshCookie(res);
        return res.status(404).json({ error: 'Session not found' });
      }

      const session = JSON.parse(sessionData);
      session.isValid = false;
      session.updatedAt = new Date().toISOString();

      console.log('🔄 [AUTH LOGOUT] Invalidating session:', refreshSessionId);
      await redisClient.set(`session:${refreshSessionId}`, JSON.stringify(session), {
        KEEPTTL: true, // Keep the original TTL
      });

      clearRefreshCookie(res);

      console.log('✅ [AUTH LOGOUT] Session invalidated successfully');
      return res.json({ success: true });
    } catch (error: any) {
      console.error('❌ [AUTH LOGOUT] Error:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/session/refresh', async (req: Request, res: Response) => {
    try {
      console.log('🔄 [AUTH REFRESH] Refresh request received');

      if (!isAuthConfigured()) {
        console.log('❌ [AUTH REFRESH] Auth service not configured');
        return res
          .status(503)
          .json({ error: 'Auth service not configured: missing AUTH_PRIVATE_KEY' });
      }

      const existingSessionId = parseRefreshCookie(req);
      if (!existingSessionId) {
        console.log('❌ [AUTH REFRESH] Refresh cookie not present');
        clearRefreshCookie(res);
        return res.status(401).json({ error: 'Refresh session not found' });
      }

      console.log('💾 [AUTH REFRESH] Loading session from Redis:', existingSessionId);
      const sessionData = await redisClient.get(`session:${existingSessionId}`);
      if (!sessionData) {
        console.log('❌ [AUTH REFRESH] Session not found:', existingSessionId);
        clearRefreshCookie(res);
        return res.status(401).json({ error: 'Session not found' });
      }

      const session = JSON.parse(sessionData);
      if (!session.isValid) {
        console.log('❌ [AUTH REFRESH] Session invalid:', existingSessionId);
        clearRefreshCookie(res);
        return res.status(401).json({ error: 'Session invalidated' });
      }

      if (!session.payload || !session.signature) {
        console.log('❌ [AUTH REFRESH] Session missing payload/signature:', existingSessionId);
        clearRefreshCookie(res);
        return res.status(401).json({ error: 'Session missing refresh data' });
      }

      console.log('🎫 [AUTH REFRESH] Generating new JWT token...');
      const token = await generateToken({
        payload: session.payload,
        signature: session.signature,
      });
      console.log('✅ [AUTH REFRESH] Token refreshed successfully');

      const newSessionId = createSessionId();
      session.sessionId = newSessionId;
      session.updatedAt = new Date().toISOString();

      const pipeline = redisClient.multi();
      pipeline.set(`session:${newSessionId}`, JSON.stringify(session), { EX: REFRESH_TTL_SECONDS });
      pipeline.del(`session:${existingSessionId}`);
      await pipeline.exec();

      setRefreshCookie(res, newSessionId);

      return res.json({
        token,
        address: session.address,
        sessionId: newSessionId,
      });
    } catch (error: any) {
      console.error('❌ [AUTH REFRESH] Error:', error);
      clearRefreshCookie(res);
      return res.status(500).json({ error: error.message || 'Failed to refresh session' });
    }
  });

  return router;
}

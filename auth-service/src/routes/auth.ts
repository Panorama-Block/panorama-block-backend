import { Router, Request, Response } from 'express';
import { RedisClientType } from 'redis';
import { verifySignature, generateToken, validateToken, generateLoginPayload, isAuthConfigured } from '../utils/thirdwebAuth';

export default function authRoutes(redisClient: RedisClientType) {
  const router = Router();

  // Login route - generates payload for wallet to sign
  router.post('/login', async (req: Request, res: Response) => {
    try {
      console.log('🔐 [AUTH LOGIN] Login request received');
      
      if (!isAuthConfigured()) {
        console.log('❌ [AUTH LOGIN] Auth service not configured');
        return res.status(503).json({ error: 'Auth service not configured: missing AUTH_PRIVATE_KEY' });
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
        return res.status(503).json({ error: 'Auth service not configured: missing AUTH_PRIVATE_KEY' });
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
      const sessionId = Math.random().toString(36).substring(2, 15);
      const sessionData = {
        userId: address,
        address,
        sessionId,
        createdAt: new Date().toISOString(),
        isValid: true
      };
      
      console.log('💾 [AUTH VERIFY] Creating session in Redis:', sessionId);
      await redisClient.set(`session:${sessionId}`, JSON.stringify(sessionData), {
        EX: 60 * 60 * 24 // 24 hours expiration
      });
      console.log('✅ [AUTH VERIFY] Session created successfully');
      
      const response = { 
        token, 
        address,
        sessionId 
      };
      
      console.log('📤 [AUTH VERIFY] Sending response:', {
        tokenLength: token.length,
        address: address,
        sessionId: sessionId,
        tokenPreview: token.substring(0, 50) + '...'
      });
      
      return res.json(response);
    } catch (error: any) {
      console.error('❌ [AUTH VERIFY] Error:', error);
      return res.status(401).json({ error: error.message });
    }
  });

  // Create one-time session for Mini App deep link return (nonce -> token)
  router.post('/miniapp/session/create', async (req: Request, res: Response) => {
    try {
      const { token, walletCookie, ttlSeconds } = req.body as { token?: string; walletCookie?: string; ttlSeconds?: number };
      if (!token && !walletCookie) {
        return res.status(400).json({ error: 'token or walletCookie required' });
      }
      const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const key = `miniapp:session:${nonce}`;
      const ttl = Math.max(60, Math.min(ttlSeconds ?? 300, 1800)); // default 5m, max 30m
      const payload = JSON.stringify({ token: token || null, walletCookie: walletCookie || null });
      await redisClient.set(key, payload, { EX: ttl });
      return res.json({ nonce, expiresIn: ttl });
    } catch (error: any) {
      console.error('❌ [MINIAPP SESSION CREATE] Error:', error);
      return res.status(500).json({ error: error.message || 'internal error' });
    }
  });

  // Consume a one-time session returning the token and invalidating it
  router.post('/miniapp/session/consume', async (req: Request, res: Response) => {
    try {
      const { nonce } = req.body as { nonce?: string };
      if (!nonce) {
        return res.status(400).json({ error: 'nonce is required' });
      }
      const key = `miniapp:session:${nonce}`;
      const json = await redisClient.get(key);
      if (!json) {
        return res.status(404).json({ error: 'session not found or expired' });
      }
      await redisClient.del(key);
      try {
        const parsed = JSON.parse(json);
        return res.json(parsed);
      } catch {
        // backward compat: if legacy string stored token only
        return res.json({ token: json });
      }
    } catch (error: any) {
      console.error('❌ [MINIAPP SESSION CONSUME] Error:', error);
      return res.status(500).json({ error: error.message || 'internal error' });
    }
  });

  // Validate token route - for internal services
  router.post('/validate', async (req: Request, res: Response) => {
    try {
      console.log('🔍 [AUTH VALIDATE] Token validation request received');
      
      if (!isAuthConfigured()) {
        console.log('❌ [AUTH VALIDATE] Auth service not configured');
        return res.status(503).json({ error: 'Auth service not configured: missing AUTH_PRIVATE_KEY' });
      }
      
      const { token, sessionId } = req.body;
      console.log('📝 [AUTH VALIDATE] Token and sessionId received:', { 
        tokenPresent: !!token, 
        sessionIdPresent: !!sessionId 
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
        payload: authData
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
      
      const { sessionId } = req.body;
      console.log('📝 [AUTH LOGOUT] SessionId received:', sessionId);
      
      if (!sessionId) {
        console.log('❌ [AUTH LOGOUT] Session ID not provided');
        return res.status(400).json({ error: 'Session ID not provided' });
      }
      
      console.log('💾 [AUTH LOGOUT] Checking session in Redis:', sessionId);
      const sessionData = await redisClient.get(`session:${sessionId}`);
      
      if (!sessionData) {
        console.log('❌ [AUTH LOGOUT] Session not found:', sessionId);
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const session = JSON.parse(sessionData);
      session.isValid = false;
      
      console.log('🔄 [AUTH LOGOUT] Invalidating session:', sessionId);
      await redisClient.set(`session:${sessionId}`, JSON.stringify(session), {
        KEEPTTL: true // Keep the original TTL
      });
      
      console.log('✅ [AUTH LOGOUT] Session invalidated successfully');
      return res.json({ success: true });
    } catch (error: any) {
      console.error('❌ [AUTH LOGOUT] Error:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
} 

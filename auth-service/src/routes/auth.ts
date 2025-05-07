import { Router, Request, Response } from 'express';
import { RedisClientType } from 'redis';
import { verifySignature, generateToken, validateToken } from '../utils/thirdwebAuth';

export default function authRoutes(redisClient: RedisClientType) {
  const router = Router();

  // Login route - generates payload for wallet to sign
  router.post('/login', (req: Request, res: Response) => {
    try {
      const { address } = req.body;
      
      if (!address) {
        return res.status(400).json({ error: 'Address not provided' });
      }
      
      // Generate a payload for the wallet to sign
      const payload = {
        type: 'evm',
        domain: process.env.AUTH_DOMAIN,
        address: address,
        statement: 'Login to Panorama Block',
        version: '1',
        chainId: '1',
        nonce: Math.random().toString(36).substring(2, 15),
        issuedAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 1000 * 60 * 5).toISOString() // 5 minutes
      };
      
      res.status(200).json({ payload });
    } catch (error: any) {
      console.error('[Auth Login] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Verify route - verifies signature and generates JWT
  router.post('/verify', async (req: Request, res: Response) => {
    try {
      const { payload, signature } = req.body;
      
      if (!payload || !signature) {
        return res.status(400).json({ error: 'Payload or signature not provided' });
      }

      // Verify the signature
      const address = await verifySignature(payload, signature);
      
      // Generate a JWT token
      const token = await generateToken(address);
      
      // Create a session in Redis
      const sessionId = Math.random().toString(36).substring(2, 15);
      const sessionData = {
        userId: address,
        address,
        sessionId,
        createdAt: new Date().toISOString(),
        isValid: true
      };
      
      await redisClient.set(`session:${sessionId}`, JSON.stringify(sessionData), {
        EX: 60 * 60 * 24 // 24 hours expiration
      });
      
      return res.json({ 
        token, 
        address,
        sessionId 
      });
    } catch (error: any) {
      console.error('[Auth Verify] Error:', error);
      return res.status(401).json({ error: error.message });
    }
  });

  // Validate token route - for internal services
  router.post('/validate', async (req: Request, res: Response) => {
    try {
      const { token, sessionId } = req.body;
      
      if (!token) {
        return res.status(400).json({ error: 'Token not provided' });
      }
      
      // Validate the JWT token
      const payload = await validateToken(token);
      
      // If sessionId is provided, check if session is valid
      if (sessionId) {
        const sessionData = await redisClient.get(`session:${sessionId}`);
        
        if (!sessionData) {
          return res.status(401).json({ error: 'Session not found' });
        }
        
        const session = JSON.parse(sessionData);
        
        if (!session.isValid) {
          return res.status(401).json({ error: 'Session is invalid' });
        }
      }
      
      return res.json({ 
        isValid: true,
        payload
      });
    } catch (error: any) {
      console.error('[Auth Validate] Error:', error);
      return res.status(401).json({ error: error.message });
    }
  });

  // Logout route
  router.post('/logout', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID not provided' });
      }
      
      const sessionData = await redisClient.get(`session:${sessionId}`);
      
      if (!sessionData) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const session = JSON.parse(sessionData);
      session.isValid = false;
      
      await redisClient.set(`session:${sessionId}`, JSON.stringify(session), {
        KEEPTTL: true // Keep the original TTL
      });
      
      return res.json({ success: true });
    } catch (error: any) {
      console.error('[Auth Logout] Error:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
} 
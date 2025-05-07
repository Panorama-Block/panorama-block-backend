import { ThirdwebAuth } from '@thirdweb-dev/auth';
import { PrivateKeyWallet } from '@thirdweb-dev/auth/evm';

// Singleton for ThirdwebAuth
// Avoids creating multiple instances
let authInstance: any = null;

// Get or create auth instance
export const getAuthInstance = (): any => {
  if (!authInstance) {
    try {
      const privateKey = process.env.AUTH_PRIVATE_KEY;
      const domain = process.env.AUTH_DOMAIN || 'panoramablock.com';
      
      if (!privateKey) {
        console.warn('[thirdwebAuth] WARNING: AUTH_PRIVATE_KEY environment variable not set');
      }
      
      // Create wallet from private key
      const wallet = new PrivateKeyWallet(privateKey || '');
      
      // Initialize ThirdwebAuth with wallet and domain
      authInstance = new ThirdwebAuth(wallet, domain);
      
      console.log('[thirdwebAuth] ThirdwebAuth instance initialized successfully with domain:', domain);
    } catch (error) {
      console.error('[thirdwebAuth] Error initializing ThirdwebAuth:', error);
      throw new Error(`Failed to initialize authentication: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return authInstance;
};

// Generate login payload with proper structure
export const generateLoginPayload = async (address: string): Promise<any> => {
  const auth = getAuthInstance();
  return await auth.generateLoginPayload({
    address,
    type: 'evm', // Explicitly set the type
    statement: 'Login to Panorama Block platform',
    domain: process.env.AUTH_DOMAIN || 'panoramablock.com',
    version: '1',
  });
};

// Verify login payload
export const verifySignature = async (payload: any, signature: string): Promise<string> => {
  const auth = getAuthInstance();
  return await auth.verifyLogin({
    payload,
    signature,
    domain: process.env.AUTH_DOMAIN || 'panoramablock.com'
  });
};

// Generate auth token
export const generateToken = async (address: string): Promise<string> => {
  const auth = getAuthInstance();
  return await auth.generateAuthToken({
    address
  });
};

// Validate JWT token
export const validateToken = async (token: string) => {
  const auth = getAuthInstance();
  return await auth.validateToken(token);
}; 
import { ThirdwebAuth } from '@thirdweb-dev/auth';
import { PrivateKeyWallet } from '@thirdweb-dev/auth/evm';
import { verifySignature as thirdwebVerifySignature } from 'thirdweb/auth';

// Singleton for ThirdwebAuth
// Avoids creating multiple instances
let authInstance: any = null;

export const isAuthConfigured = (): boolean => {
  const privateKey = process.env.AUTH_PRIVATE_KEY;
  return Boolean(privateKey && privateKey.trim() !== '');
};

// Get or create auth instance
export const getAuthInstance = (): any => {
  if (!authInstance) {
    try {
      const privateKey = process.env.AUTH_PRIVATE_KEY;
      const domain = process.env.AUTH_DOMAIN || 'panoramablock.com';
      
      if (!privateKey || privateKey.trim() === '') {
        // Não tente inicializar com chave vazia para evitar crash (invalid hexlify value)
        throw new Error('AUTH_PRIVATE_KEY is not set');
      }
      
      // Create wallet from private key
      const wallet = new PrivateKeyWallet(privateKey);
      
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
  
  const normalizedAddress = (await import("ethers")).ethers.utils.getAddress(address);

  return await auth.payload({
    address: normalizedAddress,
    statement: 'Login to Panorama Block platform',
    domain: process.env.AUTH_DOMAIN,
    version: '1',
  });
};

// Verify signature using Thirdweb v5 utils
export const verifySignature = async (payload: any, signature: string): Promise<string> => {
    
  try {

    const result = await thirdwebVerifySignature({
      message: payload,
      signature: signature,
      address: payload.address,
    });
    
    console.log('[verifySignature] Verification result:', result);
    
    if (result) {
      return payload.address;
    } else {
      throw new Error('Signature verification failed');
    }
  } catch (error) {
    console.error('[verifySignature] Verification error:', error);
    
    try {
      
      const auth = getAuthInstance();
      const result = await auth.verify(
        { payload, signature },
        { domain: process.env.AUTH_DOMAIN }
      );
      console.log('[verifySignature] Auth instance verification result:', result);
      return result;
    } catch (altError) {
      console.error('[verifySignature] Auth instance verification error:', altError);
      throw error;
    }
  }
};

// Generate auth token
export const generateToken = async (loginPayload: { payload: any; signature: string }): Promise<string> => {
  const auth = getAuthInstance();
  return await auth.generate(loginPayload, { domain: process.env.AUTH_DOMAIN || 'panoramablock.com' });
};

// Validate JWT token
export const validateToken = async (token: string) => {
  const auth = getAuthInstance();
  return await auth.authenticate(token, { domain: process.env.AUTH_DOMAIN || 'panoramablock.com' });
}; 
import { ThirdwebAuth } from '@thirdweb-dev/auth';
import { PrivateKeyWallet } from '@thirdweb-dev/auth/evm';

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
  return await auth.payload({
    // Normaliza checksum de forma defensiva, sem crash se ethers ausente
    address,
    statement: 'Login to Panorama Block platform',
    domain: process.env.AUTH_DOMAIN || 'panoramablock.com',
    version: '1',
  });
};

// Verify login payload
export const verifySignature = async (payload: any, signature: string): Promise<string> => {
  const auth = getAuthInstance();
  return await auth.verify(
    { payload, signature },
    { domain: process.env.AUTH_DOMAIN || 'panoramablock.com' },
  );
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
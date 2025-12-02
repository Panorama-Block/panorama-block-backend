import { Request, Response, NextFunction } from 'express';
import axios, { AxiosError, AxiosResponse } from 'axios';

interface TokenValidationResponse {
  isValid: boolean;
  payload: {
    address: string;
    [key: string]: any;
  };
}

interface ErrorResponse {
  error: string;
  message: string;
}

// JWT verification middleware
export const verifyJwtMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Auth] Request missing Authorization header with Bearer token');
      res.status(401).json({ error: 'Unauthorized', message: 'Missing authorization token' });
      return;
    }
    
    const token = authHeader.split(' ')[1];
    
    // Validate token with Auth service
    try {
      const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3301';
      const response: AxiosResponse<TokenValidationResponse> = 
        await axios.post(`${authServiceUrl}/auth/validate`, { token }, {
          httpsAgent: new (require('https').Agent)({
            rejectUnauthorized: false // Desabilita verificação SSL para comunicação interna
          })
        });
      
      if (response.data.isValid) {
        // Add user data to request
        req.user = response.data.payload;
        next();
        return;
      } else {
        console.log('[Auth] Invalid token provided');
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
        return;
      }
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      console.error('[Auth] Error validating token with Auth service:', 
        axiosError.response?.data?.message || axiosError.message);
        
      res.status(500).json({ 
        error: 'Authentication error', 
        message: 'Could not validate authentication' 
      });
      return;
    }
  } catch (error) {
    const err = error as Error;
    console.error('[Auth] Unexpected error in auth middleware:', err.message);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
};

// Add user type to Express Request
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
} 
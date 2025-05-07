import { Request, Response, NextFunction } from 'express';
import { validateToken } from '../utils/thirdwebAuth';

export interface AuthenticatedRequest extends Request {
  user?: {
    address: string;
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication token not provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Validate the JWT token
    const payload = await validateToken(token);
    
    // Attach user data to request
    req.user = { 
      address: payload.address 
    };
    
    next();
  } catch (err: any) {
    console.error('[authenticate] Error validating token:', err);
    return res.status(401).json({ 
      error: 'Invalid or expired token',
      details: err.message
    });
  }
}; 
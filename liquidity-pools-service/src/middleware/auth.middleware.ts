import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, User } from '../@types/auth';

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Access denied',
      message: 'No token provided'
    });
    return;
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }

    const decoded = jwt.verify(token, jwtSecret) as any;

    // Convert decoded JWT payload to User interface
    const user: User = {
      id: decoded.id || decoded.userId,
      wallet_address: decoded.wallet_address || decoded.address || decoded.walletAddress,
      email: decoded.email,
      created_at: decoded.created_at ? new Date(decoded.created_at) : new Date()
    };

    req.user = user;
    next();
  } catch (error) {
    console.error('[AuthMiddleware] Token verification failed:', error);
    res.status(403).json({
      success: false,
      error: 'Invalid token',
      message: 'Token is invalid or expired'
    });
  }
};
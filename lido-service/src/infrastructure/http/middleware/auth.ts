import { Request, Response, NextFunction } from 'express';
import { JWTService, JWTPayload } from '../../auth/jwt.service';
import { Logger } from '../../logs/logger';

interface AuthRequest extends Request {
  user?: JWTPayload;
}

export class AuthMiddleware {
  private static logger = new Logger();
  
  private static getJWTService(): JWTService {
    return new JWTService();
  }

  static authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
    try {
      // Log detalhado da requisição
      AuthMiddleware.logger.info('🔍 Debug Authentication Request:');
      AuthMiddleware.logger.info(`   Method: ${req.method}`);
      AuthMiddleware.logger.info(`   URL: ${req.url}`);
      AuthMiddleware.logger.info(`   Headers: ${JSON.stringify(req.headers, null, 2)}`);
      AuthMiddleware.logger.info(`   Body: ${JSON.stringify(req.body, null, 2)}`);
      AuthMiddleware.logger.info(`   Query: ${JSON.stringify(req.query, null, 2)}`);
      
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        AuthMiddleware.logger.error('❌ No Authorization header or invalid format');
        AuthMiddleware.logger.error(`   Auth Header: ${authHeader}`);
        res.status(401).json({
          success: false,
          error: 'Authorization header required'
        });
        return;
      }

      AuthMiddleware.logger.info(`✅ Authorization header found: ${authHeader.substring(0, 20)}...`);

      const jwtService = AuthMiddleware.getJWTService();
      const token = jwtService.extractTokenFromHeader(authHeader);
      AuthMiddleware.logger.info(`🔑 Extracted token: ${token.substring(0, 20)}...`);
      
      const decoded = jwtService.verifyAccessToken(token);
      AuthMiddleware.logger.info(`✅ Token verified successfully: ${JSON.stringify(decoded, null, 2)}`);
      
      req.user = decoded;
      AuthMiddleware.logger.info(`👤 User authenticated: ${decoded.address}`);
      
      next();
    } catch (error) {
      AuthMiddleware.logger.error(`❌ Authentication error: ${error}`);
      AuthMiddleware.logger.error(`   Error details: ${JSON.stringify(error, null, 2)}`);
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  }

  static optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const jwtService = AuthMiddleware.getJWTService();
          const token = jwtService.extractTokenFromHeader(authHeader);
          const decoded = jwtService.verifyAccessToken(token);
          req.user = decoded;
          AuthMiddleware.logger.debug(`Optional auth successful: ${decoded.address}`);
        } catch (error) {
          // Token is invalid, but we continue without authentication
          AuthMiddleware.logger.warn(`Invalid token in optional auth: ${error}`);
        }
      }
      
      next();
    } catch (error) {
      AuthMiddleware.logger.error(`Optional authentication error: ${error}`);
      next(); // Continue even if there's an error
    }
  }

  static requireUserAddress(req: AuthRequest, res: Response, next: NextFunction): void {
    try {
      if (!req.user || !req.user.address) {
        res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
        return;
      }

      // Validate that the user address in the token matches the request
      const { userAddress } = req.params;
      if (userAddress && userAddress !== req.user.address) {
        res.status(403).json({
          success: false,
          error: 'Access denied: token user does not match requested user'
        });
        return;
      }

      next();
    } catch (error) {
      AuthMiddleware.logger.error(`User address validation error: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

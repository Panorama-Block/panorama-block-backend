import { Request, Response } from 'express';
import { JWTService } from '../../auth/jwt.service';
import { Logger } from '../../logs/logger';

export class AuthController {
  private jwtService: JWTService;
  private logger: Logger;

  constructor() {
    this.jwtService = new JWTService();
    this.logger = new Logger();
  }

  /**
   * Generate tokens for a user address
   * POST /api/lido/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { userAddress } = req.body;

      if (!userAddress) {
        res.status(400).json({
          success: false,
          error: 'User address is required'
        });
        return;
      }

      // Validate Ethereum address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
        res.status(400).json({
          success: false,
          error: 'Invalid Ethereum address format'
        });
        return;
      }

      this.logger.info(`Login request for user: ${userAddress}`);

      const tokenPair = this.jwtService.generateTokenPair(userAddress);

      res.status(200).json({
        success: true,
        data: {
          userAddress,
          accessToken: tokenPair.accessToken,
          refreshToken: tokenPair.refreshToken,
          expiresIn: tokenPair.expiresIn,
          tokenType: 'Bearer'
        }
      });
    } catch (error) {
      this.logger.error(`Error in login: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Refresh access token using refresh token
   * POST /api/lido/auth/refresh
   */
  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: 'Refresh token is required'
        });
        return;
      }

      this.logger.info('Refresh token request');

      const newAccessToken = this.jwtService.refreshAccessToken(refreshToken);

      res.status(200).json({
        success: true,
        data: {
          accessToken: newAccessToken,
          tokenType: 'Bearer'
        }
      });
    } catch (error) {
      this.logger.error(`Error in refresh: ${error}`);
      res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token'
      });
    }
  }

  /**
   * Verify token validity
   * GET /api/lido/auth/verify
   */
  async verify(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'Authorization header required'
        });
        return;
      }

      const token = this.jwtService.extractTokenFromHeader(authHeader);
      const payload = this.jwtService.verifyAccessToken(token);

      res.status(200).json({
        success: true,
        data: {
          valid: true,
          userAddress: payload.address,
          expiresAt: new Date(payload.exp * 1000).toISOString(),
          issuedAt: new Date(payload.iat * 1000).toISOString()
        }
      });
    } catch (error) {
      this.logger.error(`Error in verify: ${error}`);
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  }

  /**
   * Get token information without verification
   * GET /api/lido/auth/token-info
   */
  async tokenInfo(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'Authorization header required'
        });
        return;
      }

      const token = this.jwtService.extractTokenFromHeader(authHeader);
      const isExpired = this.jwtService.isTokenExpired(token);
      const expiry = this.jwtService.getTokenExpiry(token);

      res.status(200).json({
        success: true,
        data: {
          expired: isExpired,
          expiresAt: expiry?.toISOString() || null
        }
      });
    } catch (error) {
      this.logger.error(`Error in tokenInfo: ${error}`);
      res.status(400).json({
        success: false,
        error: 'Invalid token format'
      });
    }
  }

  /**
   * Logout (client-side token invalidation)
   * POST /api/lido/auth/logout
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      this.logger.info('User logout request');

      // In a stateless JWT implementation, logout is handled client-side
      // by removing the token from storage
      // For enhanced security, you could implement a token blacklist

      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      this.logger.error(`Error in logout: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

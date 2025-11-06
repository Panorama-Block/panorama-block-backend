import jwt from 'jsonwebtoken';
import { Logger } from '../logs/logger';

export interface JWTPayload {
  address: string;
  iat: number;
  exp: number;
  sub: string; // subject (user identifier)
  iss: string; // issuer
  aud: string; // audience
  type?: string; // token type (for refresh tokens)
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class JWTService {
  private logger: Logger;
  private readonly secret: string;
  private readonly refreshSecret: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;

  constructor() {
    this.logger = new Logger();
    this.secret = process.env.JWT_SECRET || 'default-secret-change-in-production';
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-production';
    this.issuer = process.env.JWT_ISSUER || 'lido-service';
    this.audience = process.env.JWT_AUDIENCE || 'panorama-block';
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';

    this.validateConfiguration();
  }

  private validateConfiguration(): void {
    if (this.secret === 'default-secret-change-in-production') {
      this.logger.warn('Using default JWT secret. Change JWT_SECRET in production!');
    }

    if (this.refreshSecret === 'default-refresh-secret-change-in-production') {
      this.logger.warn('Using default JWT refresh secret. Change JWT_REFRESH_SECRET in production!');
    }
  }

  /**
   * Generate access and refresh tokens for a user
   */
  generateTokenPair(userAddress: string): TokenPair {
    try {
      this.logger.info(`Generating token pair for user: ${userAddress}`);

      const now = Math.floor(Date.now() / 1000);
      const accessExpiry = this.parseExpiry(this.accessTokenExpiry);
      const refreshExpiry = this.parseExpiry(this.refreshTokenExpiry);

      const accessPayload: JWTPayload = {
        address: userAddress,
        iat: now,
        exp: now + accessExpiry,
        sub: userAddress,
        iss: this.issuer,
        aud: this.audience
      };

      const refreshPayload = {
        address: userAddress,
        iat: now,
        exp: now + refreshExpiry,
        sub: userAddress,
        iss: this.issuer,
        aud: this.audience,
        type: 'refresh'
      };

      const accessToken = jwt.sign(accessPayload, this.secret, {
        algorithm: 'HS256'
      });
      
      const refreshToken = jwt.sign(refreshPayload, this.refreshSecret, {
        algorithm: 'HS256'
      });

      this.logger.info(`Token pair generated successfully for user: ${userAddress}`);

      return {
        accessToken,
        refreshToken,
        expiresIn: accessExpiry
      };
    } catch (error) {
      this.logger.error(`Error generating token pair: ${error}`);
      throw new Error('Failed to generate tokens');
    }
  }

  /**
   * Generate only access token
   */
  generateAccessToken(userAddress: string): string {
    try {
      this.logger.info(`Generating access token for user: ${userAddress}`);

      const now = Math.floor(Date.now() / 1000);
      const accessExpiry = this.parseExpiry(this.accessTokenExpiry);

      const payload: JWTPayload = {
        address: userAddress,
        iat: now,
        exp: now + accessExpiry,
        sub: userAddress,
        iss: this.issuer,
        aud: this.audience
      };

      const token = jwt.sign(payload, this.secret, {
        algorithm: 'HS256'
      });

      this.logger.info(`Access token generated successfully for user: ${userAddress}`);
      return token;
    } catch (error) {
      this.logger.error(`Error generating access token: ${error}`);
      throw new Error('Failed to generate access token');
    }
  }

  /**
   * Verify and decode access token
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      this.logger.debug('Verifying access token');

      const decoded = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: this.audience
      }) as JWTPayload;

      this.logger.debug(`Access token verified for user: ${decoded.address}`);
      return decoded;
    } catch (error) {
      this.logger.error(`Error verifying access token: ${error}`);
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Verify and decode refresh token
   */
  verifyRefreshToken(token: string): JWTPayload {
    try {
      this.logger.debug('Verifying refresh token');

      const decoded = jwt.verify(token, this.refreshSecret, {
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: this.audience
      }) as JWTPayload;

      if (!decoded.type || decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      this.logger.debug(`Refresh token verified for user: ${decoded.address}`);
      return decoded;
    } catch (error) {
      this.logger.error(`Error verifying refresh token: ${error}`);
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken(refreshToken: string): string {
    try {
      this.logger.info('Refreshing access token');

      const decoded = this.verifyRefreshToken(refreshToken);
      const newAccessToken = this.generateAccessToken(decoded.address);

      this.logger.info(`Access token refreshed for user: ${decoded.address}`);
      return newAccessToken;
    } catch (error) {
      this.logger.error(`Error refreshing access token: ${error}`);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Invalid authorization header format');
    }

    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      if (!decoded || !decoded.exp) {
        return true;
      }

      const now = Math.floor(Date.now() / 1000);
      return decoded.exp < now;
    } catch (error) {
      this.logger.error(`Error checking token expiry: ${error}`);
      return true;
    }
  }

  /**
   * Get token expiry time
   */
  getTokenExpiry(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      if (!decoded || !decoded.exp) {
        return null;
      }

      return new Date(decoded.exp * 1000);
    } catch (error) {
      this.logger.error(`Error getting token expiry: ${error}`);
      return null;
    }
  }

  /**
   * Parse expiry string to seconds
   */
  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiry format: ${expiry}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: throw new Error(`Invalid expiry unit: ${unit}`);
    }
  }
}

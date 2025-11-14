/**
 * Audit Log Service
 * Tracks all critical security events and actions
 */

import { RedisClientType } from 'redis';

/**
 * Audit Event Types
 */
export enum AuditEventType {
  // Authentication events
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_FAILED = 'AUTH_FAILED',
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED',

  // Smart Account events
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',
  SESSION_KEY_CREATED = 'SESSION_KEY_CREATED',
  SESSION_KEY_EXPIRED = 'SESSION_KEY_EXPIRED',

  // Strategy events
  STRATEGY_CREATED = 'STRATEGY_CREATED',
  STRATEGY_UPDATED = 'STRATEGY_UPDATED',
  STRATEGY_DELETED = 'STRATEGY_DELETED',
  STRATEGY_TOGGLED = 'STRATEGY_TOGGLED',

  // Swap events
  SWAP_INITIATED = 'SWAP_INITIATED',
  SWAP_SUCCESS = 'SWAP_SUCCESS',
  SWAP_FAILED = 'SWAP_FAILED',

  // Transaction events
  TRANSACTION_SIGNED = 'TRANSACTION_SIGNED',
  TRANSACTION_EXECUTED = 'TRANSACTION_EXECUTED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',

  // Security events
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CIRCUIT_BREAKER_OPENED = 'CIRCUIT_BREAKER_OPENED',
  HIGH_SLIPPAGE_DETECTED = 'HIGH_SLIPPAGE_DETECTED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}

/**
 * Audit Log Entry
 */
export interface AuditLogEntry {
  id: string;
  timestamp: number;
  eventType: AuditEventType;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Audit Logger
 * Singleton service for logging security events
 */
export class AuditLogger {
  private static instance: AuditLogger;
  private redisClient: RedisClientType | null = null;
  private readonly AUDIT_LOG_KEY = 'audit-logs';
  private readonly MAX_LOGS = 10000; // Keep last 10k logs

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Initialize with Redis client
   */
  setRedisClient(client: RedisClientType) {
    this.redisClient = client;
  }

  /**
   * Log an audit event
   */
  async log(event: {
    eventType: AuditEventType;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const entry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      eventType: event.eventType,
      userId: event.userId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      metadata: event.metadata,
      severity: this.getSeverity(event.eventType),
    };

    // Log to console
    const logMessage = this.formatLogMessage(entry);
    switch (entry.severity) {
      case 'critical':
      case 'error':
        console.error(logMessage);
        break;
      case 'warning':
        console.warn(logMessage);
        break;
      default:
        console.log(logMessage);
    }

    // Store in Redis (if available)
    if (this.redisClient) {
      try {
        await this.storeInRedis(entry);
      } catch (error) {
        console.error('[AuditLogger] Failed to store in Redis:', error);
      }
    }

    // For critical events, could send alerts here
    if (entry.severity === 'critical') {
      await this.handleCriticalEvent(entry);
    }
  }

  /**
   * Store audit log in Redis
   */
  private async storeInRedis(entry: AuditLogEntry): Promise<void> {
    if (!this.redisClient) return;

    // Store in sorted set by timestamp
    await this.redisClient.zAdd(this.AUDIT_LOG_KEY, {
      score: entry.timestamp,
      value: JSON.stringify(entry),
    });

    // Trim to keep only recent logs
    const count = await this.redisClient.zCard(this.AUDIT_LOG_KEY);
    if (count > this.MAX_LOGS) {
      const removeCount = count - this.MAX_LOGS;
      await this.redisClient.zRemRangeByRank(this.AUDIT_LOG_KEY, 0, removeCount - 1);
    }
  }

  /**
   * Get audit logs
   */
  async getLogs(options: {
    limit?: number;
    offset?: number;
    eventType?: AuditEventType;
    userId?: string;
    startTime?: number;
    endTime?: number;
  } = {}): Promise<AuditLogEntry[]> {
    if (!this.redisClient) {
      console.warn('[AuditLogger] Redis client not initialized');
      return [];
    }

    try {
      const {
        limit = 100,
        offset = 0,
        startTime = 0,
        endTime = Date.now(),
      } = options;

      // Get logs from sorted set
      const logs = await this.redisClient.zRangeByScore(
        this.AUDIT_LOG_KEY,
        startTime,
        endTime,
        {
          LIMIT: {
            offset,
            count: limit,
          },
        }
      );

      // Parse and filter logs
      let entries: AuditLogEntry[] = logs.map(log => JSON.parse(log as string));

      // Filter by event type
      if (options.eventType) {
        entries = entries.filter(e => e.eventType === options.eventType);
      }

      // Filter by user ID
      if (options.userId) {
        entries = entries.filter(e => e.userId === options.userId);
      }

      return entries.reverse(); // Most recent first
    } catch (error) {
      console.error('[AuditLogger] Failed to get logs:', error);
      return [];
    }
  }

  /**
   * Get logs by user
   */
  async getUserLogs(userId: string, limit: number = 100): Promise<AuditLogEntry[]> {
    return this.getLogs({ userId, limit });
  }

  /**
   * Get security events
   */
  async getSecurityEvents(limit: number = 100): Promise<AuditLogEntry[]> {
    const logs = await this.getLogs({ limit: limit * 3 }); // Get more to filter
    return logs.filter(log =>
      log.eventType === AuditEventType.AUTH_FAILED ||
      log.eventType === AuditEventType.AUTH_UNAUTHORIZED ||
      log.eventType === AuditEventType.RATE_LIMIT_EXCEEDED ||
      log.eventType === AuditEventType.CIRCUIT_BREAKER_OPENED ||
      log.eventType === AuditEventType.SUSPICIOUS_ACTIVITY ||
      log.severity === 'critical' ||
      log.severity === 'error'
    ).slice(0, limit);
  }

  /**
   * Determine event severity
   */
  private getSeverity(eventType: AuditEventType): 'info' | 'warning' | 'error' | 'critical' {
    switch (eventType) {
      // Critical events
      case AuditEventType.SUSPICIOUS_ACTIVITY:
      case AuditEventType.CIRCUIT_BREAKER_OPENED:
        return 'critical';

      // Error events
      case AuditEventType.AUTH_FAILED:
      case AuditEventType.SWAP_FAILED:
      case AuditEventType.TRANSACTION_FAILED:
        return 'error';

      // Warning events
      case AuditEventType.AUTH_UNAUTHORIZED:
      case AuditEventType.RATE_LIMIT_EXCEEDED:
      case AuditEventType.HIGH_SLIPPAGE_DETECTED:
      case AuditEventType.SESSION_KEY_EXPIRED:
        return 'warning';

      // Info events
      default:
        return 'info';
    }
  }

  /**
   * Format log message
   */
  private formatLogMessage(entry: AuditLogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const userInfo = entry.userId ? ` [User: ${entry.userId}]` : '';
    const metadataStr = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';

    return `[AUDIT] [${timestamp}] [${entry.severity.toUpperCase()}] ${entry.eventType}${userInfo}${metadataStr}`;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Handle critical events
   */
  private async handleCriticalEvent(entry: AuditLogEntry): Promise<void> {
    // In production, this could:
    // - Send alerts to Slack/PagerDuty
    // - Send email to security team
    // - Trigger automated response
    console.error('🚨 CRITICAL SECURITY EVENT:', {
      eventType: entry.eventType,
      userId: entry.userId,
      metadata: entry.metadata,
    });

    // Could implement alerting here
    // await this.sendSlackAlert(entry);
    // await this.sendEmailAlert(entry);
  }
}

/**
 * Helper function to log audit events
 */
export async function logAuditEvent(
  eventType: AuditEventType,
  userId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const logger = AuditLogger.getInstance();
  await logger.log({ eventType, userId, metadata });
}

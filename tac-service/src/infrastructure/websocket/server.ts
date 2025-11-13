// TAC Service WebSocket Server Configuration
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';

import { DIContainer } from '../di/container';
import { getSecurityConfig } from '../../config/environment';
import { logger } from '../utils/logger';

// WebSocket event handlers
import { TacOperationSocketHandler } from './handlers/TacOperationSocketHandler';
import { TacBalanceSocketHandler } from './handlers/TacBalanceSocketHandler';
import { TacNotificationSocketHandler } from './handlers/TacNotificationSocketHandler';
import { TacAnalyticsSocketHandler } from './handlers/TacAnalyticsSocketHandler';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  conversationId?: string;
}

export function createWebSocketServer(httpServer: any, container: DIContainer): SocketIOServer {
  const securityConfig = getSecurityConfig();

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: securityConfig.cors.origin,
      methods: ['GET', 'POST'],
      credentials: true
    },
    path: '/ws',
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Setup Redis adapter for multi-instance WebSocket scaling
  if (container.config.REDIS_URL) {
    setupRedisAdapter(io, container.config.REDIS_URL);
  }

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        throw new Error('Authentication token required');
      }

      const decoded = jwt.verify(token, securityConfig.jwt.secret) as any;

      socket.userId = decoded.sub || decoded.userId;
      socket.userRole = decoded.role || 'user';
      socket.conversationId = socket.handshake.query.conversationId as string;

      logger.debug(`WebSocket authenticated: userId=${socket.userId}, role=${socket.userRole}`);
      next();
    } catch (error) {
      logger.warn(`WebSocket authentication failed: ${error.message}`);
      next(new Error('Authentication failed'));
    }
  });

  // Connection handling
  io.on('connection', async (socket: AuthenticatedSocket) => {
    const { userId, userRole, conversationId } = socket;

    logger.info(`WebSocket connected: userId=${userId}, socketId=${socket.id}, conversationId=${conversationId}`);

    // Join user-specific rooms
    await socket.join(`user:${userId}`);
    if (conversationId) {
      await socket.join(`conversation:${conversationId}`);
    }
    if (userRole === 'admin') {
      await socket.join('admin');
    }

    // Initialize event handlers
    const operationHandler = new TacOperationSocketHandler(container, socket);
    const balanceHandler = new TacBalanceSocketHandler(container, socket);
    const notificationHandler = new TacNotificationSocketHandler(container, socket);
    const analyticsHandler = new TacAnalyticsSocketHandler(container, socket);

    // Register event listeners
    setupSocketEventListeners(socket, {
      operationHandler,
      balanceHandler,
      notificationHandler,
      analyticsHandler
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to TAC Service WebSocket',
      userId,
      timestamp: new Date().toISOString(),
      features: {
        realTimeOperations: true,
        balanceUpdates: true,
        notifications: container.config.ENABLE_PUSH_NOTIFICATIONS,
        analytics: container.config.ENABLE_ANALYTICS && userRole === 'admin'
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`WebSocket disconnected: userId=${userId}, socketId=${socket.id}, reason=${reason}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`WebSocket error: userId=${userId}, socketId=${socket.id}, error=${error.message}`);
    });
  });

  // Global error handling
  io.engine.on('connection_error', (error) => {
    logger.error('WebSocket connection error:', {
      code: error.code,
      message: error.message,
      context: error.context
    });
  });

  logger.info('✅ WebSocket server configured with authentication and event handlers');

  return io;
}

function setupSocketEventListeners(
  socket: AuthenticatedSocket,
  handlers: {
    operationHandler: TacOperationSocketHandler;
    balanceHandler: TacBalanceSocketHandler;
    notificationHandler: TacNotificationSocketHandler;
    analyticsHandler: TacAnalyticsSocketHandler;
  }
) {
  // TAC Operation events
  socket.on('operation:subscribe', handlers.operationHandler.subscribeToOperation.bind(handlers.operationHandler));
  socket.on('operation:unsubscribe', handlers.operationHandler.unsubscribeFromOperation.bind(handlers.operationHandler));
  socket.on('operation:get_status', handlers.operationHandler.getOperationStatus.bind(handlers.operationHandler));
  socket.on('operation:cancel', handlers.operationHandler.cancelOperation.bind(handlers.operationHandler));

  // Balance events
  socket.on('balance:subscribe', handlers.balanceHandler.subscribeToBalanceUpdates.bind(handlers.balanceHandler));
  socket.on('balance:unsubscribe', handlers.balanceHandler.unsubscribeFromBalanceUpdates.bind(handlers.balanceHandler));
  socket.on('balance:refresh', handlers.balanceHandler.refreshBalances.bind(handlers.balanceHandler));

  // Notification events
  socket.on('notification:subscribe', handlers.notificationHandler.subscribeToNotifications.bind(handlers.notificationHandler));
  socket.on('notification:unsubscribe', handlers.notificationHandler.unsubscribeFromNotifications.bind(handlers.notificationHandler));
  socket.on('notification:mark_read', handlers.notificationHandler.markNotificationAsRead.bind(handlers.notificationHandler));

  // Analytics events (admin only)
  if (socket.userRole === 'admin') {
    socket.on('analytics:subscribe', handlers.analyticsHandler.subscribeToAnalytics.bind(handlers.analyticsHandler));
    socket.on('analytics:unsubscribe', handlers.analyticsHandler.unsubscribeFromAnalytics.bind(handlers.analyticsHandler));
    socket.on('analytics:get_metrics', handlers.analyticsHandler.getMetrics.bind(handlers.analyticsHandler));
  }

  // Health check
  socket.on('ping', (callback) => {
    if (typeof callback === 'function') {
      callback({
        pong: true,
        timestamp: new Date().toISOString(),
        userId: socket.userId
      });
    }
  });
}

async function setupRedisAdapter(io: SocketIOServer, redisUrl: string): Promise<void> {
  try {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    await Promise.all([
      pubClient.connect(),
      subClient.connect()
    ]);

    io.adapter(createAdapter(pubClient, subClient));

    logger.info('✅ Redis adapter configured for WebSocket scaling');
  } catch (error) {
    logger.warn('⚠️ Failed to setup Redis adapter, WebSocket will run in single instance mode:', error.message);
  }
}

// WebSocket notification helper for other services
export class WebSocketNotificationService {
  private io?: SocketIOServer;
  private enabled: boolean;

  constructor(options: { enablePush: boolean }) {
    this.enabled = options.enablePush;
  }

  setIOInstance(io: SocketIOServer): void {
    this.io = io;
  }

  async sendToUser(userId: string, event: string, data: any): Promise<void> {
    if (!this.enabled || !this.io) return;

    try {
      this.io.to(`user:${userId}`).emit(event, {
        ...data,
        timestamp: new Date().toISOString()
      });

      logger.debug(`WebSocket notification sent to user ${userId}: ${event}`);
    } catch (error) {
      logger.error(`Failed to send WebSocket notification to user ${userId}:`, error);
    }
  }

  async sendToConversation(conversationId: string, event: string, data: any): Promise<void> {
    if (!this.enabled || !this.io) return;

    try {
      this.io.to(`conversation:${conversationId}`).emit(event, {
        ...data,
        timestamp: new Date().toISOString()
      });

      logger.debug(`WebSocket notification sent to conversation ${conversationId}: ${event}`);
    } catch (error) {
      logger.error(`Failed to send WebSocket notification to conversation ${conversationId}:`, error);
    }
  }

  async sendToAdmins(event: string, data: any): Promise<void> {
    if (!this.enabled || !this.io) return;

    try {
      this.io.to('admin').emit(event, {
        ...data,
        timestamp: new Date().toISOString()
      });

      logger.debug(`WebSocket notification sent to admins: ${event}`);
    } catch (error) {
      logger.error('Failed to send WebSocket notification to admins:', error);
    }
  }

  async broadcast(event: string, data: any): Promise<void> {
    if (!this.enabled || !this.io) return;

    try {
      this.io.emit(event, {
        ...data,
        timestamp: new Date().toISOString()
      });

      logger.debug(`WebSocket broadcast sent: ${event}`);
    } catch (error) {
      logger.error('Failed to send WebSocket broadcast:', error);
    }
  }
}
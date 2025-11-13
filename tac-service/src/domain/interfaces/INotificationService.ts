export interface NotificationMessage {
  id?: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  channels: NotificationChannel[];
  scheduledFor?: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export type NotificationType =
  | 'operation_started'
  | 'operation_progress'
  | 'operation_completed'
  | 'operation_failed'
  | 'balance_updated'
  | 'rewards_available'
  | 'system_alert'
  | 'security_alert';

export type NotificationChannel =
  | 'websocket'
  | 'push'
  | 'telegram'
  | 'email'
  | 'sms';

export interface WebSocketUpdate {
  operationId: string;
  type: 'step_started' | 'step_completed' | 'step_failed' | 'operation_completed' | 'operation_failed';
  step?: {
    stepId: string;
    stepType: string;
    status: string;
    transactionHash?: string;
    outputAmount?: string;
  };
  progress: number; // 0-100
  estimatedCompletion?: string;
  message: string;
  timestamp: Date;
}

export interface PushNotificationConfig {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  data?: Record<string, any>;
}

export interface TelegramNotificationConfig {
  chatId: string;
  message: string;
  parseMode?: 'HTML' | 'Markdown';
  disableWebPagePreview?: boolean;
  replyMarkup?: {
    inline_keyboard: Array<Array<{
      text: string;
      callback_data?: string;
      url?: string;
    }>>;
  };
}

export interface INotificationService {
  // Core notification methods
  sendNotification(notification: NotificationMessage): Promise<void>;
  sendToUser(userId: string, message: NotificationMessage): Promise<void>;
  sendBulk(notifications: NotificationMessage[]): Promise<void>;

  // Real-time WebSocket notifications
  subscribeToUserUpdates(userId: string, callback: (update: WebSocketUpdate) => void): Promise<void>;
  unsubscribeFromUserUpdates(userId: string): Promise<void>;
  broadcastToUser(userId: string, update: WebSocketUpdate): Promise<void>;
  broadcastToAll(update: Omit<WebSocketUpdate, 'operationId'>): Promise<void>;

  // Push notifications (PWA)
  sendPushNotification(userId: string, config: PushNotificationConfig): Promise<void>;
  registerPushSubscription(userId: string, subscription: any): Promise<void>;
  unregisterPushSubscription(userId: string): Promise<void>;

  // Telegram notifications
  sendTelegramNotification(config: TelegramNotificationConfig): Promise<void>;
  registerTelegramUser(userId: string, telegramChatId: string): Promise<void>;
  unregisterTelegramUser(userId: string): Promise<void>;

  // Email notifications
  sendEmail(to: string, subject: string, html: string, text?: string): Promise<void>;

  // Notification preferences
  getUserPreferences(userId: string): Promise<NotificationPreferences>;
  updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void>;

  // Notification history
  getNotificationHistory(userId: string, limit?: number, offset?: number): Promise<NotificationMessage[]>;
  markAsRead(userId: string, notificationId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;

  // Template management
  registerTemplate(templateId: string, template: NotificationTemplate): Promise<void>;
  sendFromTemplate(templateId: string, userId: string, variables: Record<string, any>): Promise<void>;
}

export interface NotificationPreferences {
  channels: {
    websocket: boolean;
    push: boolean;
    telegram: boolean;
    email: boolean;
    sms: boolean;
  };
  types: {
    operation_started: boolean;
    operation_progress: boolean;
    operation_completed: boolean;
    operation_failed: boolean;
    balance_updated: boolean;
    rewards_available: boolean;
    system_alert: boolean;
    security_alert: boolean;
  };
  quiet_hours?: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string;   // HH:MM format
    timezone: string;
  };
  frequency: {
    immediate: boolean;
    batched: boolean;
    batch_interval: number; // minutes
  };
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  channels: NotificationChannel[];
  title: string;
  body: string;
  variables: string[]; // List of required variables
  metadata?: Record<string, any>;
}

// Specialized notification services
export interface ITacOperationNotificationService extends INotificationService {
  // TAC operation specific notifications
  notifyOperationStarted(userId: string, operationId: string, details: {
    operationType: string;
    estimatedTime: number;
    totalAmount: string;
    fromChain: string;
    toChain: string;
  }): Promise<void>;

  notifyStepProgress(userId: string, operationId: string, step: {
    stepType: string;
    status: string;
    transactionHash?: string;
    progress: number;
  }): Promise<void>;

  notifyOperationCompleted(userId: string, operationId: string, result: {
    outputAmount: string;
    outputToken: string;
    totalTime: number;
    totalFees: string;
  }): Promise<void>;

  notifyOperationFailed(userId: string, operationId: string, error: {
    message: string;
    code?: string;
    canRetry: boolean;
  }): Promise<void>;

  notifyBalanceUpdated(userId: string, balance: {
    tokenSymbol: string;
    newBalance: string;
    change: string;
    protocol: string;
  }): Promise<void>;

  notifyRewardsAvailable(userId: string, rewards: {
    protocol: string;
    amount: string;
    token: string;
    apy: number;
  }): Promise<void>;
}

// WebSocket connection manager
export interface IWebSocketManager {
  // Connection management
  addConnection(userId: string, connectionId: string, socket: any): Promise<void>;
  removeConnection(connectionId: string): Promise<void>;
  getUserConnections(userId: string): Promise<string[]>;
  isUserConnected(userId: string): Promise<boolean>;

  // Message broadcasting
  sendToUser(userId: string, message: any): Promise<void>;
  sendToConnection(connectionId: string, message: any): Promise<void>;
  broadcast(message: any): Promise<void>;

  // Connection health
  pingConnections(): Promise<void>;
  getConnectionStats(): Promise<{
    totalConnections: number;
    activeUsers: number;
    connectionsPerUser: Record<string, number>;
  }>;
}

// Notification queue for async processing
export interface INotificationQueue {
  enqueue(notification: NotificationMessage): Promise<void>;
  dequeue(): Promise<NotificationMessage | null>;
  peek(): Promise<NotificationMessage | null>;
  size(): Promise<number>;
  clear(): Promise<void>;

  // Batch operations
  enqueueBatch(notifications: NotificationMessage[]): Promise<void>;
  dequeueBatch(count: number): Promise<NotificationMessage[]>;

  // Failed notification handling
  requeueFailed(notification: NotificationMessage, retryCount: number): Promise<void>;
  getFailedNotifications(): Promise<NotificationMessage[]>;
  clearFailed(): Promise<void>;
}

// Analytics for notifications
export interface INotificationAnalytics {
  trackNotificationSent(notification: NotificationMessage): Promise<void>;
  trackNotificationDelivered(notificationId: string, channel: NotificationChannel): Promise<void>;
  trackNotificationClicked(notificationId: string, userId: string): Promise<void>;

  getDeliveryStats(timeframe: string): Promise<{
    sent: number;
    delivered: number;
    clicked: number;
    deliveryRate: number;
    clickRate: number;
    byChannel: Record<NotificationChannel, {
      sent: number;
      delivered: number;
      deliveryRate: number;
    }>;
  }>;

  getUserEngagementStats(userId: string): Promise<{
    totalReceived: number;
    totalClicked: number;
    engagementRate: number;
    preferredChannels: NotificationChannel[];
    responseTime: number; // average time to click
  }>;
}
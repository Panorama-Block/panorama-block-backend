// TAC Service Dependency Injection Container
import { PrismaClient } from '@prisma/client';
import { validateEnvironment, EnvironmentConfig } from '../../config/environment';

// Domain interfaces
import { ITacRepository } from '../../domain/interfaces/ITacRepository';
import { ITacSdkBridgeService } from '../../domain/interfaces/ITacSdkBridgeService';
import { INotificationService } from '../../domain/interfaces/INotificationService';
import { ITacAnalyticsService } from '../../domain/interfaces/ITacAnalyticsService';
import { IBalanceSyncService } from '../../domain/interfaces/IBalanceSyncService';
import { IBridgeProviderService } from '../../domain/interfaces/IBridgeProviderService';

// Infrastructure implementations
import { TacSdkAdapter } from '../tac/TacSdkAdapter';
import { PrismaTacRepository } from '../persistence/PrismaTacRepository';
import { WebSocketNotificationService } from '../notifications/WebSocketNotificationService';
import { TacAnalyticsService } from '../analytics/TacAnalyticsService';
import { BalanceSyncService } from '../services/BalanceSyncService';
import { TacBridgeProviderService } from '../services/TacBridgeProviderService';

// Application services
import { TacOperationService } from '../../application/services/TacOperationService';
import { TacQuoteService } from '../../application/services/TacQuoteService';
import { TacBalanceService } from '../../application/services/TacBalanceService';
import { TacConfigurationService } from '../../application/services/TacConfigurationService';
import { TacEventService } from '../../application/services/TacEventService';

// Use cases
import { InitiateCrossChainOperationUseCase } from '../../application/usecases/InitiateCrossChainOperationUseCase';
import { GetCrossChainQuoteUseCase } from '../../application/usecases/GetCrossChainQuoteUseCase';
import { TrackOperationStatusUseCase } from '../../application/usecases/TrackOperationStatusUseCase';
import { GetUserBalancesUseCase } from '../../application/usecases/GetUserBalancesUseCase';
import { UpdateUserConfigurationUseCase } from '../../application/usecases/UpdateUserConfigurationUseCase';
import { ClaimRewardsUseCase } from '../../application/usecases/ClaimRewardsUseCase';

// Background services
import { OperationMonitorService } from '../services/OperationMonitorService';
import { AnalyticsAggregatorService } from '../services/AnalyticsAggregatorService';
import { NotificationProcessorService } from '../services/NotificationProcessorService';
import { DataCleanupScheduler } from '../services/DataCleanupScheduler';

export interface DIContainer {
  // Configuration
  config: EnvironmentConfig;

  // Database
  database: PrismaClient;

  // Repositories
  tacRepository: ITacRepository;

  // External services
  tacSdkService: ITacSdkBridgeService;
  notificationService: INotificationService;
  analyticsService: ITacAnalyticsService;
  balanceSyncService: IBalanceSyncService;
  bridgeProviderService: IBridgeProviderService;

  // Application services
  tacOperationService: TacOperationService;
  tacQuoteService: TacQuoteService;
  tacBalanceService: TacBalanceService;
  tacConfigurationService: TacConfigurationService;
  tacEventService: TacEventService;

  // Use cases
  initiateCrossChainOperation: InitiateCrossChainOperationUseCase;
  getCrossChainQuote: GetCrossChainQuoteUseCase;
  trackOperationStatus: TrackOperationStatusUseCase;
  getUserBalances: GetUserBalancesUseCase;
  updateUserConfiguration: UpdateUserConfigurationUseCase;
  claimRewards: ClaimRewardsUseCase;

  // Background services
  operationMonitor: OperationMonitorService;
  analyticsAggregator: AnalyticsAggregatorService;
  notificationProcessor: NotificationProcessorService;
  cleanupScheduler: DataCleanupScheduler;
}

export async function createDIContainer(): Promise<DIContainer> {
  // Load and validate configuration
  const config = validateEnvironment();

  // Initialize database connection
  const database = new PrismaClient({
    log: config.DEBUG ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
    datasources: {
      db: {
        url: config.DATABASE_URL
      }
    }
  });

  // Test database connection
  await database.$connect();

  // Initialize repositories
  const tacRepository = new PrismaTacRepository(database);

  // Initialize external services
  const tacSdkService = new TacSdkAdapter(
    config.TAC_SDK_ENDPOINT,
    config.TAC_API_KEY,
    {
      supportedChains: config.TAC_SUPPORTED_CHAINS.split(',').map(chain => chain.trim()),
      defaultTimeout: config.TAC_DEFAULT_BRIDGE_TIMEOUT,
      maxRetries: config.TAC_MAX_RETRY_ATTEMPTS,
      webhookSecret: config.TAC_WEBHOOK_SECRET
    }
  );

  const notificationService = new WebSocketNotificationService({
    enablePush: config.ENABLE_PUSH_NOTIFICATIONS
  });

  const analyticsService = new TacAnalyticsService(database, {
    enableAnalytics: config.ENABLE_ANALYTICS
  });

  const balanceSyncService = new BalanceSyncService(
    tacRepository,
    tacSdkService,
    analyticsService
  );

  const bridgeProviderService = new TacBridgeProviderService(
    tacRepository,
    analyticsService
  );

  // Initialize application services
  const tacOperationService = new TacOperationService(
    tacRepository,
    tacSdkService,
    notificationService,
    analyticsService
  );

  const tacQuoteService = new TacQuoteService(
    tacRepository,
    tacSdkService,
    bridgeProviderService
  );

  const tacBalanceService = new TacBalanceService(
    tacRepository,
    balanceSyncService,
    analyticsService
  );

  const tacConfigurationService = new TacConfigurationService(
    tacRepository,
    notificationService
  );

  const tacEventService = new TacEventService(
    tacRepository,
    notificationService,
    analyticsService
  );

  // Initialize use cases
  const initiateCrossChainOperation = new InitiateCrossChainOperationUseCase(
    tacOperationService,
    tacQuoteService,
    tacConfigurationService,
    tacEventService
  );

  const getCrossChainQuote = new GetCrossChainQuoteUseCase(
    tacQuoteService,
    tacConfigurationService
  );

  const trackOperationStatus = new TrackOperationStatusUseCase(
    tacOperationService,
    tacEventService
  );

  const getUserBalances = new GetUserBalancesUseCase(
    tacBalanceService,
    tacConfigurationService
  );

  const updateUserConfiguration = new UpdateUserConfigurationUseCase(
    tacConfigurationService,
    tacEventService
  );

  const claimRewards = new ClaimRewardsUseCase(
    tacBalanceService,
    tacOperationService,
    tacEventService
  );

  // Initialize background services
  const operationMonitor = new OperationMonitorService(
    tacRepository,
    tacSdkService,
    notificationService,
    analyticsService,
    {
      checkInterval: 30000, // 30 seconds
      batchSize: 50
    }
  );

  const analyticsAggregator = new AnalyticsAggregatorService(
    tacRepository,
    analyticsService,
    {
      aggregationInterval: 300000, // 5 minutes
      retentionPeriod: 180 * 24 * 60 * 60 * 1000 // 6 months
    }
  );

  const notificationProcessor = new NotificationProcessorService(
    tacRepository,
    notificationService,
    {
      batchSize: 100,
      processingInterval: 10000 // 10 seconds
    }
  );

  const cleanupScheduler = new DataCleanupScheduler(
    tacRepository,
    {
      cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
      expiredQuoteRetention: 24 * 60 * 60 * 1000, // 24 hours
      oldAnalyticsRetention: 180 * 24 * 60 * 60 * 1000, // 6 months
      processedEventRetention: 30 * 24 * 60 * 60 * 1000, // 30 days
      notificationRetention: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  );

  return {
    config,
    database,
    tacRepository,
    tacSdkService,
    notificationService,
    analyticsService,
    balanceSyncService,
    bridgeProviderService,
    tacOperationService,
    tacQuoteService,
    tacBalanceService,
    tacConfigurationService,
    tacEventService,
    initiateCrossChainOperation,
    getCrossChainQuote,
    trackOperationStatus,
    getUserBalances,
    updateUserConfiguration,
    claimRewards,
    operationMonitor,
    analyticsAggregator,
    notificationProcessor,
    cleanupScheduler
  };
}

// Graceful container shutdown
export async function closeDIContainer(container: DIContainer): Promise<void> {
  try {
    // Stop background services
    await container.operationMonitor?.stop?.();
    await container.analyticsAggregator?.stop?.();
    await container.notificationProcessor?.stop?.();
    await container.cleanupScheduler?.stop?.();

    // Close database connection
    await container.database.$disconnect();

    console.log('✅ DI Container gracefully shutdown');
  } catch (error) {
    console.error('❌ Error during container shutdown:', error);
    throw error;
  }
}
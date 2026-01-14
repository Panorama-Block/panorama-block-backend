import { PrismaClient } from '@prisma/client';
import { validateEnvironment, EnvironmentConfig } from '../../config/environment';

// Domain Ports
import { BridgeProviderPort } from '../../domain/ports/BridgeProviderPort';

// Infrastructure implementations
import { LayerswapAdapter } from '../adapters/LayerswapAdapter';

// Application Use Cases
import { CreateBridgeTransactionUseCase } from '../../application/use-cases/CreateBridgeTransactionUseCase';
import { GetBridgeQuoteUseCase } from '../../application/use-cases/GetBridgeQuoteUseCase';
import { GetBridgeStatusUseCase } from '../../application/use-cases/GetBridgeStatusUseCase';

// Controllers
import { BridgeController } from '../../interfaces/http/controllers/BridgeController';

export interface DIContainer {
  config: EnvironmentConfig;
  database: PrismaClient;
  layerswapAdapter: BridgeProviderPort;
  createBridgeTransaction: CreateBridgeTransactionUseCase;
  getBridgeQuote: GetBridgeQuoteUseCase;
  getBridgeStatus: GetBridgeStatusUseCase;
  bridgeController: BridgeController;
}

export async function createDIContainer(): Promise<DIContainer> {
  const config = validateEnvironment();

  const prismaLogLevels: ('query' | 'info' | 'warn' | 'error')[] = ['warn', 'error'];
  if (config.DEBUG) prismaLogLevels.push('info');
  if (process.env.PRISMA_LOG_QUERIES === 'true') prismaLogLevels.unshift('query');

  const database = new PrismaClient({
    log: prismaLogLevels,
    datasources: {
      db: {
        url: config.DATABASE_URL
      }
    }
  });

  await database.$connect();

  const layerswapAdapter = new LayerswapAdapter();
  const createBridgeTransaction = new CreateBridgeTransactionUseCase(layerswapAdapter);
  const getBridgeQuote = new GetBridgeQuoteUseCase(layerswapAdapter);
  const getBridgeStatus = new GetBridgeStatusUseCase(layerswapAdapter);
  const bridgeController = new BridgeController(createBridgeTransaction, getBridgeQuote, getBridgeStatus);

  return {
    config,
    database,
    layerswapAdapter,
    createBridgeTransaction,
    getBridgeQuote,
    getBridgeStatus,
    bridgeController,
  };
}

export async function closeDIContainer(container: DIContainer): Promise<void> {
  try {
    await container.database.$disconnect();
    console.log('✅ DI Container gracefully shutdown');
  } catch (error) {
    console.error('❌ Error during container shutdown:', error);
    throw error;
  }
}

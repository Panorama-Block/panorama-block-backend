import { Container } from 'inversify';
import { TYPES } from './types';

// Domain Ports
import { ILiquidityProvider } from '../../domain/ports/liquidity.port';
import { IPoolProvider } from '../../domain/ports/pool.port';
import { IPositionRepository } from '../../domain/ports/position-repository.port';

// Infrastructure Adapters
import { UniswapLPAPIAdapter } from '../adapters/uniswap-lp-api.adapter';
import { HooksDetectorAdapter } from '../adapters/hooks-detector.adapter';

// Application Services
import { TickMathService } from '../../application/services/tick-math.service';
import { NotificationService } from '../../application/services/notification.service';
import { APRCalculatorService } from '../../application/services/apr-calculator.service';

// Application Use Cases
import { GetPositionsUseCase } from '../../application/usecases/positions/get-positions.usecase';
import { CreatePositionUseCase } from '../../application/usecases/positions/create-position.usecase';

// HTTP Controllers
import { PositionsController } from '../http/controllers/positions.controller';
import { PoolsController } from '../http/controllers/pools.controller';
import { HooksController } from '../http/controllers/hooks.controller';
import { AnalyticsController } from '../http/controllers/analytics.controller';

const container = new Container();

// ========== Infrastructure Layer ==========

// External Adapters
container.bind<ILiquidityProvider>(TYPES.ILiquidityProvider).to(UniswapLPAPIAdapter).inSingletonScope();
container.bind<HooksDetectorAdapter>(TYPES.HooksDetectorAdapter).to(HooksDetectorAdapter).inSingletonScope();

// Repository implementations (Mock for MVP)
container.bind<IPositionRepository>(TYPES.IPositionRepository).toConstantValue({
  async findByOwner(owner: string, chainId?: number) {
    // Mock implementation - in production, this would query a database
    return [];
  },
  async findById(id: string) {
    // Mock implementation
    return null;
  },
  async save(position: any) {
    // Mock implementation
    return position;
  },
  async delete(id: string) {
    // Mock implementation
    return true;
  }
});

// Pool provider (Mock for MVP)
container.bind<IPoolProvider>(TYPES.IPoolProvider).toConstantValue({
  async getPool(poolId: string, chainId: number) {
    // Mock implementation - in production, this would query pool data
    return null;
  },
  async findPools(filters: any) {
    // Mock implementation
    return [];
  },
  async getPoolStats(poolId: string, chainId: number) {
    // Mock implementation
    return null;
  }
});

// ========== Application Layer ==========

// Services
container.bind<TickMathService>(TYPES.TickMathService).to(TickMathService).inSingletonScope();
container.bind<APRCalculatorService>(TYPES.APRCalculatorService).to(APRCalculatorService).inSingletonScope();

// Notification Service with optional Redis
container.bind<NotificationService>(TYPES.NotificationService).toDynamicValue((context) => {
  // In production, inject Redis client here
  const redisClient = undefined; // TODO: Initialize Redis client
  return new NotificationService(redisClient);
}).inSingletonScope();

// Use Cases
container.bind<GetPositionsUseCase>(TYPES.GetPositionsUseCase).toDynamicValue((context) => {
  return new GetPositionsUseCase(
    context.container.get<ILiquidityProvider>(TYPES.ILiquidityProvider),
    context.container.get<NotificationService>(TYPES.NotificationService),
    context.container.get<APRCalculatorService>(TYPES.APRCalculatorService)
  );
}).inSingletonScope();

container.bind<CreatePositionUseCase>(TYPES.CreatePositionUseCase).toDynamicValue((context) => {
  return new CreatePositionUseCase(
    context.container.get<ILiquidityProvider>(TYPES.ILiquidityProvider),
    context.container.get<TickMathService>(TYPES.TickMathService),
    context.container.get<HooksDetectorAdapter>(TYPES.HooksDetectorAdapter),
    context.container.get<APRCalculatorService>(TYPES.APRCalculatorService)
  );
}).inSingletonScope();

// ========== Presentation Layer ==========

// Controllers
container.bind<PositionsController>(TYPES.PositionsController).toDynamicValue((context) => {
  return new PositionsController(
    context.container.get<GetPositionsUseCase>(TYPES.GetPositionsUseCase),
    context.container.get<CreatePositionUseCase>(TYPES.CreatePositionUseCase)
  );
}).inSingletonScope();

container.bind<PoolsController>(TYPES.PoolsController).toDynamicValue((context) => {
  return new PoolsController();
}).inSingletonScope();

container.bind<HooksController>(TYPES.HooksController).toDynamicValue((context) => {
  return new HooksController(
    context.container.get<HooksDetectorAdapter>(TYPES.HooksDetectorAdapter)
  );
}).inSingletonScope();

container.bind<AnalyticsController>(TYPES.AnalyticsController).toDynamicValue((context) => {
  return new AnalyticsController(
    context.container.get<APRCalculatorService>(TYPES.APRCalculatorService)
  );
}).inSingletonScope();

export { container };
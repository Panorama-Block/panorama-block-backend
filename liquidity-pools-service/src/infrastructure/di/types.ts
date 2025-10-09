export const TYPES = {
  // Domain Ports
  ILiquidityProvider: Symbol.for('ILiquidityProvider'),
  IPoolProvider: Symbol.for('IPoolProvider'),
  IPositionRepository: Symbol.for('IPositionRepository'),

  // Infrastructure Adapters
  HooksDetectorAdapter: Symbol.for('HooksDetectorAdapter'),

  // Application Services
  TickMathService: Symbol.for('TickMathService'),
  NotificationService: Symbol.for('NotificationService'),
  APRCalculatorService: Symbol.for('APRCalculatorService'),

  // Application Use Cases
  GetPositionsUseCase: Symbol.for('GetPositionsUseCase'),
  CreatePositionUseCase: Symbol.for('CreatePositionUseCase'),

  // HTTP Controllers
  PositionsController: Symbol.for('PositionsController'),
  PoolsController: Symbol.for('PoolsController'),
  HooksController: Symbol.for('HooksController'),
  AnalyticsController: Symbol.for('AnalyticsController'),

  // External Services
  RedisClient: Symbol.for('RedisClient'),
  Logger: Symbol.for('Logger')
};
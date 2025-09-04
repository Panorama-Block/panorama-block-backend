// Dependency Injection Container
import { SwapDomainService } from "../../domain/services/swap.domain.service";
import {
  ExecuteSwapUseCase,
  GetSwapHistoryUseCase,
} from "../../application/usecases/execute.swap.usecase";
import { GetQuoteUseCase } from "../../application/usecases/get.quote.usecase";
import { PrepareSwapUseCase } from "../../application/usecases/prepare.swap.usecase";
import { ThirdwebSwapAdapter } from "../adapters/thirdweb.swap.adapter";
import { ChainProviderAdapter } from "../adapters/chain.provider.adapter";
import { SwapRepositoryAdapter } from "../adapters/swap.repository.adapter";
import { SwapController } from "../http/controllers/swap.controller";
import { GetSwapStatusUseCase } from "../../application/usecases/get.status.usecase";
import { EngineExecutionAdapter } from "../adapters/engine.execution.adapter";
import { IExecutionPort } from "../../domain/ports/execution.port";

export class DIContainer {
  private static instance: DIContainer;

  // Infrastructure
  private readonly _thirdwebSwapAdapter: ThirdwebSwapAdapter;
  private readonly _chainProviderAdapter: ChainProviderAdapter;
  private readonly _swapRepositoryAdapter: SwapRepositoryAdapter;

  // Domain
  private readonly _swapDomainService: SwapDomainService;

  // Application
  private readonly _getQuoteUseCase: GetQuoteUseCase;
  private readonly _prepareSwapUseCase: PrepareSwapUseCase;
  private readonly _executeSwapUseCase: ExecuteSwapUseCase;
  private readonly _getSwapHistoryUseCase: GetSwapHistoryUseCase;
  private readonly _getSwapStatusUseCase: GetSwapStatusUseCase;

  // Controllers
  private readonly _swapController: SwapController;

  private constructor() {
    console.log("[DIContainer] Initializing dependency injection container");

    // Initialize adapters
    this._thirdwebSwapAdapter = new ThirdwebSwapAdapter();
    this._chainProviderAdapter = new ChainProviderAdapter();
    this._swapRepositoryAdapter = new SwapRepositoryAdapter();

    // Initialize domain services
    this._swapDomainService = new SwapDomainService(
      this._thirdwebSwapAdapter,
      this._chainProviderAdapter,
      this._swapRepositoryAdapter
    );

    // Initialize use cases
    this._getQuoteUseCase = new GetQuoteUseCase(this._swapDomainService);
    this._prepareSwapUseCase = new PrepareSwapUseCase(this._swapDomainService);
    // Execution port (conditionally enabled)
    const engineEnabled = process.env.ENGINE_ENABLED === "true";
    let executionPort: IExecutionPort;
    if (engineEnabled) {
      try {
        executionPort = new EngineExecutionAdapter();
        console.log("[DIContainer] Engine execution enabled");
      } catch (err) {
        console.error("[DIContainer] Engine execution initialization failed:", (err as Error).message);
        executionPort = {
          async executeOriginTxs() {
            throw new Error("Engine initialization failed; execution unavailable");
          },
        };
      }
    } else {
      executionPort = {
        async executeOriginTxs() {
          throw new Error("Server-side execution disabled (ENGINE_ENABLED !== true)");
        },
      };
    }

    this._executeSwapUseCase = new ExecuteSwapUseCase(this._swapDomainService, executionPort);
    this._getSwapHistoryUseCase = new GetSwapHistoryUseCase(
      this._swapDomainService
    );
    this._getSwapStatusUseCase = new GetSwapStatusUseCase(this._swapDomainService);

    // Initialize controller
    this._swapController = new SwapController(
      this._getQuoteUseCase,
      this._prepareSwapUseCase,
      this._executeSwapUseCase,
      this._getSwapHistoryUseCase,
      this._getSwapStatusUseCase
    );

    console.log(
      "[DIContainer] Dependency injection container initialized successfully"
    );
  }

  public static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  public get swapController(): SwapController {
    return this._swapController;
  }

  public get getQuoteUseCase(): GetQuoteUseCase {
    return this._getQuoteUseCase;
  }

  public get prepareSwapUseCase(): PrepareSwapUseCase {
    return this._prepareSwapUseCase;
  }

  public get executeSwapUseCase(): ExecuteSwapUseCase {
    return this._executeSwapUseCase;
  }

  public get getSwapHistoryUseCase(): GetSwapHistoryUseCase {
    return this._getSwapHistoryUseCase;
  }

  public get swapDomainService(): SwapDomainService {
    return this._swapDomainService;
  }

  public get getSwapStatusUseCase(): GetSwapStatusUseCase {
    return this._getSwapStatusUseCase;
  }
}

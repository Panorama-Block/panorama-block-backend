import { Router, Request, Response, NextFunction } from "express";
import { DIContainer } from "../../di/container";

console.log("[Swap Routes] Configuring swap routes with hexagonal architecture");

export const swapRouter = Router();

// Get controller from DI container
const container = DIContainer.getInstance();
const swapController = container.swapController;

// Helper para serializar BigInt para JSON
function safeStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  );
}

// Middleware para logging de requisições
swapRouter.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[Swap Route] ${req.method} ${req.originalUrl}`);
  console.log(`[Swap Route] Body: ${safeStringify(req.body).substring(0, 200)}...`);
  
  // Monitorar tempo de resposta
  const start = Date.now();
  
  // Interceptar final da resposta para logar o tempo
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[Swap Route] Resposta enviada com status ${res.statusCode} em ${duration}ms`);
  });
  
  next();
});

// Middleware que envolve controllers com try-catch
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(err => {
    console.error(`[Swap Route] Erro não tratado: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Erro interno no processamento do swap",
        message: err.message
      });
    }
    next(err);
  });
};

// Registrar rotas com o novo controller hexagonal
console.log("[Swap Routes] Registering swap routes with hexagonal architecture");

// QUOTE ENDPOINTS
// Get quote for a swap (no execution)
swapRouter.post("/quote", asyncHandler(swapController.getQuote));

// EXECUTION ENDPOINTS  
// Execute swap - extracts user from JWT token
swapRouter.post("/execute", asyncHandler(swapController.executeSwap));
swapRouter.post("/manual", asyncHandler(swapController.executeSwap)); // Backward compatibility

// HISTORY ENDPOINTS
// Get swap history - user address from JWT if not provided
swapRouter.get("/history", asyncHandler(swapController.getSwapHistory)); // Uses JWT user
swapRouter.get("/history/:userAddress", asyncHandler(swapController.getSwapHistory)); // Specific user (same user only)

// STATUS ENDPOINTS
// Get swap status by transaction hash
swapRouter.get("/status/:transactionHash", asyncHandler(swapController.getStatus));

// Health check específico para o módulo de swap
swapRouter.get("/health", asyncHandler((req: Request, res: Response) => {
  res.json({
    status: "ok",
    module: "swap",
    architecture: "hexagonal",
    timestamp: new Date().toISOString(),
    authentication: "JWT required",
    endpoints: {
      "POST /swap/quote": "Get swap quote (no execution)",
      "POST /swap/execute": "Execute cross-chain swap",
      "POST /swap/manual": "Execute cross-chain swap (legacy endpoint)",
      "GET /swap/history": "Get authenticated user's swap history",
      "GET /swap/history/:userAddress": "Get specific user's swap history (same user only)",
      "GET /swap/status/:transactionHash": "Get swap transaction status",
      "GET /swap/health": "Swap module health check"
    },
    supportedChains: [1, 137, 56, 8453, 10, 42161, 43114],
    features: [
      "Cross-chain token swaps",
      "Real-time quotes",
      "Transaction monitoring", 
      "Swap history tracking",
      "Multi-chain support",
      "JWT Authentication"
    ]
  });
})); 
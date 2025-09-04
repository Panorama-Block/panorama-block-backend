// backend/liquid-swap-service/src/index.ts

import "dotenv/config";
// Usamos require() para garantir o objeto de runtime do express,
// evitando o erro "This expression is not callable" no seu setup.
const expressLib = require("express") as any;

import type {
  Request,
  Response,
  NextFunction,
} from "express-serve-static-core";
import cors from "cors";
import { swapRouter } from "./infrastructure/http/routes/swap.routes";
import { verifyJwtMiddleware } from "./middleware/authMiddleware";

const PORT = process.env.PORT || process.env.LIQUID_SWAP_PORT || 3002;

try {
  console.log(
    "[Liquid Swap Service] 🚀 Initializing with Hexagonal Architecture..."
  );

  // Debug logging
  if (process.env.DEBUG === "true") {
    console.log("[Liquid Swap Service] Configuration:");
    console.log("- PORT:", PORT);
    console.log("- NODE_ENV:", process.env.NODE_ENV);
    console.log("- AUTH_SERVICE_URL:", process.env.AUTH_SERVICE_URL);
    console.log(
      "- THIRDWEB_CLIENT_ID:",
      process.env.THIRDWEB_CLIENT_ID ? "[CONFIGURED]" : "[NOT SET]"
    );
    console.log(
      "- AUTH_PRIVATE_KEY:",
      process.env.AUTH_PRIVATE_KEY ? "[CONFIGURED]" : "[NOT SET]"
    );
  }

  const app = expressLib();

  // Middlewares
  console.log("[Liquid Swap Service] ⚙️  Configuring middlewares...");
  app.use(cors());
  app.use(expressLib.json({ limit: "10mb" }));
  app.use(expressLib.urlencoded({ extended: true, limit: "10mb" }));

  // Request logging (opcional via DEBUG)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (process.env.DEBUG === "true") {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    }
    next();
  });

  // Rotas protegidas por JWT
  console.log("[Liquid Swap Service] 🔗 Registering routes...");
  app.use("/swap", verifyJwtMiddleware, swapRouter);

  // Health check
  app.get("/health", (_req: Request, res: Response) => {
    try {
      console.log("[Health] Health check requested");
      res.json({
        status: "ok",
        service: "liquid-swap-service",
        version: "1.0.0",
        architecture: "hexagonal",
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString(),
        supportedChains: [1, 137, 56, 8453, 10, 42161, 43114],
        integrations: {
          thirdweb: process.env.THIRDWEB_CLIENT_ID
            ? "configured"
            : "not configured",
          authService: process.env.AUTH_SERVICE_URL
            ? "configured"
            : "not configured",
        },
      });
    } catch (error) {
      const err = error as Error;
      console.error("[Health] Error processing health check:", err.message);
      res.status(500).json({
        status: "error",
        message: "Internal error in health check",
      });
    }
  });

  // Root info
  app.get("/", (_req: Request, res: Response) => {
    try {
      res.json({
        name: "PanoramaBlock Liquid Swap Service",
        description:
          "Cross-chain token swaps using ThirdWeb SDK with Hexagonal Architecture",
        version: "1.0.0",
        architecture: {
          pattern: "hexagonal",
          layers: ["domain", "application", "infrastructure"],
          principles: [
            "Domain-Driven Design",
            "Dependency Injection",
            "Clean Architecture",
          ],
        },
        environment: process.env.NODE_ENV || "development",
        endpoints: {
          "/health": "Service health check",
          "/swap/quote": "Get quote (requires JWT auth)",
          "/swap/tx": "Get prepared tx bundle (requires JWT auth)",
          "/swap/execute": process.env.ENGINE_ENABLED === "true"
            ? "Execute via Engine (ERC4337, requires JWT)"
            : "Disabled (set ENGINE_ENABLED=true)",
          "/swap/history": "Get user swap history (requires JWT auth)",
          "/swap/status/:transactionHash?chainId=...": "Get route status for a transaction (requires JWT)",
        },
        supportedChains: {
          "1": "Ethereum Mainnet",
          "137": "Polygon",
          "56": "Binance Smart Chain",
          "8453": "Base",
          "10": "Optimism",
          "42161": "Arbitrum One",
          "43114": "Avalanche C-Chain",
        },
        features: [
          "Cross-chain token swaps",
          "Prepared transactions (non-custodial)",
          "Transaction monitoring",
          "Swap history tracking",
          "JWT Authentication",
          "User wallet integration",
        ],
        integrations: {
          thirdweb: process.env.THIRDWEB_CLIENT_ID
            ? "✅ Configured"
            : "❌ Not configured",
          auth_service: process.env.AUTH_SERVICE_URL || "❌ Not configured",
        },
        security: {
          authentication: "JWT tokens via auth-service",
          wallet_handling: "Non-custodial — client signs and sends",
          transaction_execution: "Server returns prepared bundle only",
        },
      });
    } catch (error) {
      const err = error as Error;
      console.error(
        "[Info] Error processing information request:",
        err.message
      );
      res
        .status(500)
        .json({ error: "Internal error while retrieving information" });
    }
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    console.warn(`[404] Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
      error: "Endpoint not found",
      path: req.originalUrl,
      method: req.method,
      availableEndpoints: [
        "GET /",
        "GET /health",
        "POST /swap/quote",
        "POST /swap/tx",
        "GET /swap/history",
        "POST /swap/execute",
        "GET /swap/status/:transactionHash?chainId=...",
      ],
    });
  });

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[Error] Unhandled application error:", err.message);
    if (process.env.DEBUG === "true") {
      console.error("[Error] Stack trace:", err.stack);
    }

    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal server error",
        message:
          process.env.NODE_ENV === "development"
            ? err.message
            : "An error occurred",
        architecture: "hexagonal",
      });
    }
  });

  // Start server
  console.log(`[Liquid Swap Service] 🌟 Starting server on port ${PORT}...`);
  const server = app.listen(PORT, () => {
    console.log(`\n🎉 [Liquid Swap Service] Server running successfully!`);
    console.log(`📊 Port: ${PORT}`);
    console.log(`🏗️  Architecture: Hexagonal (Domain-Driven Design)`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
    console.log(`📖 Documentation: http://localhost:${PORT}/`);
    console.log(`🔄 Swap API: http://localhost:${PORT}/swap/`);
    console.log(`✨ Ready to process cross-chain swaps!\n`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log(
      "[Liquid Swap Service] SIGTERM received, shutting down gracefully..."
    );
    server.close(() => {
      console.log("[Liquid Swap Service] Server closed");
      process.exit(0);
    });
  });
} catch (error) {
  const err = error as Error;
  console.error(
    "[Liquid Swap Service] 💥 Fatal error initializing service:",
    err.message
  );
  if (process.env.DEBUG === "true") {
    console.error("[Liquid Swap Service] Stack trace:", err.stack);
  }
  process.exit(1);
}

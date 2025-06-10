import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { swapRouter } from "./routes/swap";
import { verifyJwtMiddleware } from "./middleware/authMiddleware";

const PORT = process.env.PORT || process.env.LIQUID_SWAP_PORT;

try {
  console.log("[Service] Initializing Liquid Swap service...");
  const app = express();

  // Middleware configuration
  console.log("[Service] Configuring middlewares (CORS, JSON)...");
  app.use(cors());
  app.use(express.json());

  // Setting up routes
  console.log("[Service] Registering routes...");
  
  // Swap routes with JWT verification
  console.log("[Service] Registering swap routes...");
  app.use("/swap", verifyJwtMiddleware, swapRouter);

  // Health check route
  console.log("[Service] Registering health check route...");
  app.get("/health", (req: Request, res: Response) => {
    try {
      console.log("[Health] Received health check request");
      res.json({
        status: "ok",
        service: "liquid-swap-service",
        version: "1.0.0",
        supportedChains: [1, 137, 56, 8453, 10, 42161], // Ethereum, Polygon, BSC, Base, Optimism, Arbitrum
      });
      console.log("[Health] Health check responded successfully");
    } catch (error) {
      const err = error as Error;
      console.error("[Health] Error processing health check:", err.message);
      res.status(500).json({ error: "Internal error in health check" });
    }
  });

  // Information route
  console.log("[Service] Registering main information route...");
  app.get("/", (req: Request, res: Response) => {
    try {
      console.log("[Info] Received information request");
      res.json({
        name: "Liquid Swap Service API",
        description: "API for cross-chain token swaps",
        version: "1.0.0",
        endpoints: {
          "/health": "Check service status",
          "/swap/manual": "Execute swap between chains",
        },
        supportedChains: {
          "1": "Ethereum",
          "137": "Polygon",
          "56": "Binance Smart Chain",
          "8453": "Base",
          "10": "Optimism",
          "42161": "Arbitrum",
        },
      });
      console.log("[Info] Information responded successfully");
    } catch (error) {
      const err = error as Error;
      console.error("[Info] Error processing information request:", err.message);
      res.status(500).json({ error: "Internal error while retrieving information" });
    }
  });

  // Middleware for routes not found
  app.use((req: Request, res: Response) => {
    console.warn(`[404] Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
      error: "Endpoint not found",
      path: req.originalUrl,
      method: req.method
    });
  });

  // Global error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error("[Error] Unhandled error in application:", err.message);
    res.status(500).json({
      error: "Internal server error",
      message: err.message || "An unknown error occurred"
    });
  });

  // Start server
  console.log("[Service] Starting server on port", PORT);
  app.listen(PORT, () => {
    console.log(`[Service] Liquid Swap service running on port ${PORT}`);
    console.log(`[Service] Health check available at http://localhost:${PORT}/health`);
    console.log(`[Service] Documentation available at http://localhost:${PORT}/`);
  });
} catch (error) {
  const err = error as Error;
  console.error("[Service] Fatal error initializing service:", err.message);
  process.exit(1);
} 
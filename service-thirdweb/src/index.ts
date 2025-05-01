// src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import { swapRouter } from "./routes/swap";
import { authRouter } from "./routes/auth";

const PORT = process.env.PORT || 3001;

try {
  console.log("[Service] Initializing Thirdweb service...");
  const app = express();

  // Middleware configuration
  console.log("[Service] Configuring middlewares (CORS, JSON)...");
  app.use(cors());
  app.use(express.json());

  // Setting up routes
  console.log("[Service] Registering routes...");
  
  // Swap routes
  console.log("[Service] Registering swap routes...");
  app.use("/swap", swapRouter);
  
  // Authentication routes
  console.log("[Service] Registering auth routes...");
  app.use("/auth", authRouter);

  // Health check route
  console.log("[Service] Registering health check route...");
  app.get("/health", (req, res) => {
    try {
      console.log("[Health] Received health check request");
      res.json({
        status: "ok",
        service: "thirdweb-service",
        version: "1.0.0",
        supportedChains: [1, 137, 56, 8453, 10, 42161], // Ethereum, Polygon, BSC, Base, Optimism, Arbitrum
      });
      console.log("[Health] Health check responded successfully");
    } catch (error) {
      console.error("[Health] Error processing health check:", error);
      res.status(500).json({ error: "Internal error in health check" });
    }
  });

  // Information route
  console.log("[Service] Registering main information route...");
  app.get("/", (req, res) => {
    try {
      console.log("[Info] Received information request");
      res.json({
        name: "Thirdweb Service API",
        description: "API for interactions with the Thirdweb SDK",
        version: "1.0.0",
        endpoints: {
          "/health": "Check service status",
          "/swap/manual": "Execute swap between chains",
          "/auth/login": "Start SIWE login (if implemented)",
          "/auth/verify": "Verify SIWE signature (if implemented)",
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
      console.error("[Info] Error processing information request:", error);
      res.status(500).json({ error: "Internal error while retrieving information" });
    }
  });

  // Middleware for routes not found
  app.use((req, res) => {
    console.warn(`[404] Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
      error: "Endpoint not found",
      path: req.originalUrl,
      method: req.method
    });
  });

  // Global error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("[Error] Unhandled error in application:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err.message || "An unknown error occurred"
    });
  });

  // Start server
  console.log("[Service] Starting server on port", PORT);
  app.listen(PORT, () => {
    console.log(`[Service] Thirdweb service running on port ${PORT}`);
    console.log(`[Service] Health check available at http://localhost:${PORT}/health`);
    console.log(`[Service] Documentation available at http://localhost:${PORT}/`);
  });
} catch (error) {
  console.error("[Service] Fatal error initializing service:", error);
  process.exit(1);
}

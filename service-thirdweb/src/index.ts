// src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import https from "https";
import * as fs from "fs";
import { swapRouter } from "./routes/swap";
import { authRouter } from "./routes/auth";

const PORT = process.env.PORT || 3001;

try {
  console.log("[Service] Initializing Thirdweb service...");
  const app = express();

  // SSL certificate options for HTTPS
  const getSSLOptions = () => {
    try {
      const certPath = process.env.FULLCHAIN || "/etc/letsencrypt/live/api.panoramablock.com/fullchain.pem";
      const keyPath = process.env.PRIVKEY || "/etc/letsencrypt/live/api.panoramablock.com/privkey.pem";
      
      console.log(`[Liquid Swap Service] Verificando certificados SSL em: ${certPath} e ${keyPath}`);
      
      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        console.log('[Liquid Swap Service] ✅ Certificados SSL encontrados!');
        return {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        };
      } else {
        console.warn('[Liquid Swap Service] ⚠️ Certificados SSL não encontrados nos caminhos:');
        console.warn(`- Cert: ${certPath} (${fs.existsSync(certPath) ? 'existe' : 'não existe'})`);
        console.warn(`- Key: ${keyPath} (${fs.existsSync(keyPath) ? 'existe' : 'não existe'})`);
        console.warn('Executando em modo HTTP.');
        return null;
      }
    } catch (error) {
      console.warn('[Liquid Swap Service] ❌ Erro ao carregar certificados SSL:', error);
      return null;
    }
  };


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
  const sslOptions = getSSLOptions();
  
  if (sslOptions) {
    const server = https.createServer(sslOptions, app).listen(PORT, () => {
      console.log(`\n🎉 [Thirdweb Service] HTTPS Server running successfully!`);
      console.log(`📊 Port: ${PORT}`);
      console.log(`🔒 Protocol: HTTPS`);
      console.log(`🏗️  Architecture: Hexagonal (Domain-Driven Design)`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`📋 Health check: https://localhost:${PORT}/health`);
      console.log(`📖 Documentation: https://localhost:${PORT}/`);
      console.log(`🔄 Swap API: https://localhost:${PORT}/swap/`);
      console.log(`✨ Ready to process cross-chain swaps!\n`);
    });

    // Graceful shutdown
    process.on("SIGTERM", () => {
      console.log(
        "[Thirdweb Service] SIGTERM received, shutting down gracefully..."
      );
      server.close(() => {
        console.log("[Thirdweb Service] Server closed");
        process.exit(0);
      });
    });
  } else {
    const server = app.listen(PORT, () => {
      console.log(`\n🎉 [Thirdweb Service] HTTP Server running successfully!`);
      console.log(`📊 Port: ${PORT}`);
      console.log(`🔓 Protocol: HTTP`);
      console.log(`🏗️  Architecture: Hexagonal (Domain-Driven Design)`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
      console.log(`📖 Documentation: http://localhost:${PORT}/`);
      console.log(`🔄 Swap API: http://localhost:${PORT}/swap/`);
      console.log(`✨ Ready to process cross-chain swaps!\n`);
      if (process.env.NODE_ENV === 'production') {
        console.warn('[Thirdweb Service] WARNING: Running in HTTP mode in production. SSL certificates not found.');
      }
    });

    // Graceful shutdown
    process.on("SIGTERM", () => {
      console.log(
        "[Thirdweb Service] SIGTERM received, shutting down gracefully..."
      );
      server.close(() => {
        console.log("[Thirdweb Service] Server closed");
        process.exit(0);
      });
    });
  }
} catch (error) {
  const err = error as Error;
  console.error(
    "[Thirdweb Service] 💥 Fatal error initializing service:",
    err.message
  );
  if (process.env.DEBUG === "true") {
    console.error("[Thirdweb Service] Stack trace:", err.stack);
  }
  process.exit(1);
}
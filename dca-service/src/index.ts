import express, { Router } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { DatabaseService } from './services/database.service';
import { dcaRoutes } from './routes/dca.routes';
import { createTransactionRoutes } from './routes/transaction.routes';
import { startDCAExecutor } from './jobs/dca.executor';
import { AuditLogger } from './services/auditLog.service';
import {
  forceHTTPS,
  securityHeaders,
  removeSensitiveHeaders,
  securityLogger,
  validateRequestSize
} from './middleware/security.middleware';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.DCA_PORT || process.env.PORT || 3003;

// Security middleware (applied first)
app.use(securityLogger);
app.use(removeSensitiveHeaders);
app.use(forceHTTPS);
app.use(securityHeaders);
app.use(validateRequestSize(2 * 1024 * 1024)); // 2MB max request size

// Standard middleware
app.use(express.json());
app.use(cors());

// Environment logging
console.log('\n💰 [DCA SERVICE] Environment Variables:');
console.log('='.repeat(60));
console.log('📊 PORT:', PORT);
console.log('🌍 NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('🗄️  DATABASE_URL:', process.env.DATABASE_URL ? '[SET]' : '[NOT SET]');
console.log('🔑 THIRDWEB_CLIENT_ID:', process.env.THIRDWEB_CLIENT_ID ? '[SET]' : '[NOT SET]');
console.log('🔒 ENCRYPTION_PASSWORD:', process.env.ENCRYPTION_PASSWORD ? '[SET]' : '[NOT SET]');
console.log('='.repeat(60));

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('🏥 [HEALTH CHECK] DCA Service health check requested');
  res.status(200).json({
    status: 'ok',
    service: 'dca-service',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint (before Redis connection)
app.get('/', (req, res) => {
  console.log('🏠 [ROOT] Service info requested');
  res.json({
    name: 'PanoramaBlock DCA Service',
    description: 'Dollar Cost Averaging with Account Abstraction',
    version: '1.0.0',
    endpoints: {
      '/health': 'Health check',
      '/dca/create-account': 'Create smart account with session keys',
      '/dca/accounts/:userId': 'Get user smart accounts',
      '/dca/account/:address': 'Get smart account details',
      '/dca/create-strategy': 'Create DCA strategy',
      '/dca/strategies/:smartAccountId': 'Get account strategies',
      '/dca/history/:smartAccountId': 'Get execution history',
      '/transaction/sign-and-execute': '🔐 SECURE: Sign & execute transaction (private key never leaves backend!)',
      '/transaction/validate': 'Validate transaction permissions',
      '/dca/debug/circuit-breakers': '🔍 Monitor circuit breaker status',
      '/dca/debug/audit-logs': '📋 View audit logs (with filters)',
      '/dca/debug/audit-logs/security': '⚠️ View security events only',
      '/dca/debug/audit-logs/user/:userId': '👤 View user-specific audit logs'
    }
  });
});

// Initialize database
async function initializeDatabase() {
  try {
    console.log('[DCA Service] 🔌 Connecting to PostgreSQL...');

    // Get database instance
    const db = DatabaseService.getInstance();

    // Check connection
    const connected = await db.checkConnection();
    if (!connected) {
      throw new Error('Failed to connect to PostgreSQL');
    }

    console.log('[DCA Service] ✅ Connected to PostgreSQL successfully');

    // Initialize schema
    console.log('[DCA Service] 📋 Initializing database schema...');
    await db.initializeSchema();

    // Initialize Audit Logger
    const auditLogger = AuditLogger.getInstance();
    console.log('[DCA Service] ✅ Audit Logger initialized');

    // Register routes
    app.use('/dca', dcaRoutes());
    app.use('/transaction', createTransactionRoutes());
    console.log('[DCA Service] ✅ Routes registered');

    // 404 handler - MUST be after all routes
    app.use((req, res) => {
      console.warn(`[404] Route not found: ${req.method} ${req.originalUrl}`);
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
      });
    });

    // Global error handler
    app.use((err: any, req: any, res: any, next: any) => {
      console.error('[Error] Unhandled error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message || 'An unknown error occurred'
      });
    });

    // Start DCA executor cron job
    startDCAExecutor();

    console.log('[DCA Service] ✅ Database initialization complete');
  } catch (err) {
    console.error('[DCA Service] ❌ Database initialization error:', err);
    process.exit(1);
  }
}

// Initialize database before starting server
initializeDatabase();

// Start server
const server = app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`\n🎉 [DCA Service] Server running successfully!`);
  console.log(`📊 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`💰 DCA API: http://localhost:${PORT}/dca/`);
  console.log(`✨ Ready to handle DCA operations!\n`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[DCA Service] SIGTERM received, shutting down gracefully...");
  server.close(async () => {
    console.log("[DCA Service] Server closed");
    const db = DatabaseService.getInstance();
    await db.close();
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("\n[DCA Service] SIGINT received, shutting down gracefully...");
  server.close(async () => {
    console.log("[DCA Service] Server closed");
    const db = DatabaseService.getInstance();
    await db.close();
    process.exit(0);
  });
});

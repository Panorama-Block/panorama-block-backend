require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

// Importar rotas
const lendingRoutes = require('./routes/lendingRoutes');
const swapRoutes = require('./routes/swapRoutes');
const validationRoutes = require('./routes/validationRoutes');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware de segurança
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));

// Rate limiting global
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 200, // 200 requests por window
  message: {
    error: 'Muitas requisições',
    message: 'Tente novamente em alguns minutos'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// Logging
app.use(morgan('combined'));

// Parser de JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'Panorama Frontend API',
    version: '1.0.0',
    network: process.env.NETWORK_NAME || 'Avalanche C-Chain'
  });
});

// Informações da API
app.get('/info', (req, res) => {
  res.json({
    name: 'Panorama Frontend API',
    description: 'API Frontend para Panorama Block - Interface simplificada para usuários',
    version: '1.0.0',
    network: process.env.NETWORK_NAME || 'Avalanche C-Chain',
    chainId: process.env.CHAIN_ID || 43114,
    supportedProtocols: [
      'Benqi Lending',
      'Trader Joe DEX',
      'Validation System'
    ],
    features: [
      'Lending simplificado',
      'Swap de tokens',
      'Validação automática',
      'Smart wallet integration',
      'Rate limiting',
      'Autenticação por assinatura'
    ],
    endpoints: {
      lending: '/lending/*',
      swap: '/swap/*',
      validation: '/validation/*',
      health: '/health',
      info: '/info'
    },
    swapEndpoints: {
      tokens: '/swap/tokens',
      price: '/swap/price',
      quote: '/swap/quote',
      validateQuote: '/swap/validate-quote',
      validateSwap: '/swap/validate-swap'
    },
    features: [
      'Smart wallet integration',
      'Transaction preparation',
      'Rate limiting',
      'Signature authentication',
      'Validation integration',
      'Lending operations',
      'Swap operations'
    ],
    lendingEndpoints: {
      qtokens: '/lending/qtokens',
      enterMarkets: '/lending/enter-markets',
      exitMarket: '/lending/exit-market',
      validateSupply: '/lending/validate-supply',
      validateRedeem: '/lending/validate-redeem',
      validateBorrow: '/lending/validate-borrow',
      validateRepay: '/lending/validate-repay'
    },
  });
});

// Rotas principais
app.use('/lending', lendingRoutes);
app.use('/swap', swapRoutes);
app.use('/validation', validationRoutes);

// Middleware de erro global
app.use((err, req, res, next) => {
  console.error('Erro na API Frontend:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
});

// Rota não encontrada
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Rota ${req.method} ${req.originalUrl} não encontrada`,
      availableRoutes: [
        'GET /health',
        'GET /info',
        'GET/POST /lending/*',
        'GET/POST /swap/*',
        'GET/POST /validation/*'
      ]
    }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('🚀 Panorama Frontend API iniciada!');
  console.log(`📡 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 Info: http://localhost:${PORT}/info`);
  console.log(`🔗 Backend API: ${process.env.BACKEND_API_URL}`);
  console.log(`🌍 Rede: ${process.env.NETWORK_NAME} (${process.env.CHAIN_ID})`);
  console.log('');
  console.log('📚 Endpoints disponíveis:');
  console.log('  • /lending/* - Operações de lending');
  console.log('  • /swap/* - Operações de swap');
  console.log('  • /validation/* - Sistema de validação');
  console.log('  • /health - Status da API');
  console.log('  • /info - Informações da API');
});

module.exports = app;

const { ethers } = require('ethers');

/**
 * Middleware para verificar assinatura de smart wallet
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next function
 */
function verifySignature(req, res, next) {
  try {
    const { address, signature, message, timestamp } = req.body;

    // Verificar se todos os campos obrigatórios estão presentes
    if (!address || !signature || !message || !timestamp) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_AUTH_DATA',
          message: 'Dados de autenticação obrigatórios: address, signature, message, timestamp'
        }
      });
    }

    // Verificar se a assinatura não expirou (5 minutos)
    const now = Date.now();
    const timeDiff = now - timestamp;
    const maxAge = 5 * 60 * 1000; // 5 minutos

    if (timeDiff > maxAge) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'SIGNATURE_EXPIRED',
          message: 'Assinatura expirada. Use uma assinatura mais recente.'
        }
      });
    }

    // Verificar se a assinatura é válida
    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Assinatura inválida'
        }
      });
    }

    // Verificar se o endereço recuperado corresponde ao endereço fornecido
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'ADDRESS_MISMATCH',
          message: 'Endereço não corresponde à assinatura'
        }
      });
    }

    // Adicionar dados verificados ao request
    req.verifiedAddress = address.toLowerCase();
    req.authData = {
      address: address.toLowerCase(),
      signature,
      message,
      timestamp
    };

    console.log(`🔐 Autenticação verificada para: ${address}`);
    next();

  } catch (error) {
    console.error('Erro na verificação de assinatura:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_VERIFICATION_ERROR',
        message: 'Erro interno na verificação de assinatura'
      }
    });
  }
}

/**
 * Middleware para verificar se o backend está disponível
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next function
 */
async function checkBackendHealth(req, res, next) {
  try {
    const BackendService = require('../services/backendService');
    const backendService = new BackendService();
    
    const healthCheck = await backendService.checkHealth();
    
    if (!healthCheck.success) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'BACKEND_UNAVAILABLE',
          message: 'Serviço backend indisponível',
          details: healthCheck.error
        }
      });
    }

    req.backendHealthy = true;
    next();

  } catch (error) {
    console.error('Erro ao verificar saúde do backend:', error);
    res.status(503).json({
      success: false,
      error: {
        code: 'BACKEND_CHECK_ERROR',
        message: 'Erro ao verificar disponibilidade do backend'
      }
    });
  }
}

/**
 * Middleware para sanitizar inputs
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next function
 */
function sanitizeInput(req, res, next) {
  try {
    // Sanitizar endereços Ethereum
    if (req.body.address) {
      req.body.address = req.body.address.toLowerCase();
    }

    // Sanitizar endereços de contratos
    const contractFields = ['qTokenAddress', 'tokenIn', 'tokenOut'];
    contractFields.forEach(field => {
      if (req.body[field]) {
        req.body[field] = req.body[field].toLowerCase();
      }
    });

    // Sanitizar arrays de endereços
    if (req.body.qTokenAddresses && Array.isArray(req.body.qTokenAddresses)) {
      req.body.qTokenAddresses = req.body.qTokenAddresses.map(addr => addr.toLowerCase());
    }

    // Validar valores numéricos
    const numericFields = ['amount', 'amountIn', 'minAmountOut'];
    numericFields.forEach(field => {
      if (req.body[field]) {
        const value = req.body[field];
        if (typeof value === 'string' && !/^\d+$/.test(value)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_NUMERIC_VALUE',
              message: `Valor inválido para ${field}: deve ser um número`
            }
          });
        }
      }
    });

    next();

  } catch (error) {
    console.error('Erro na sanitização:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'SANITIZATION_ERROR',
        message: 'Erro na validação dos dados de entrada'
      }
    });
  }
}

/**
 * Middleware para validar rede
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next function
 */
function validateNetwork(req, res, next) {
  const expectedChainId = process.env.CHAIN_ID || '43114';
  
  if (req.body.chainId && req.body.chainId !== expectedChainId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_NETWORK',
        message: `Rede inválida. Esperado: ${expectedChainId}, Recebido: ${req.body.chainId}`
      }
    });
  }

  next();
}

/**
 * Middleware para criar rate limiter personalizado
 * @param {number} max - Número máximo de requests
 * @param {number} windowMs - Janela de tempo em ms
 * @returns {Function} Rate limiter middleware
 */
function createRateLimiter(max, windowMs) {
  const rateLimit = require('express-rate-limit');
  
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Muitas requisições. Tente novamente em alguns minutos.'
      }
    },
    standardHeaders: true,
    legacyHeaders: false
  });
}

module.exports = {
  verifySignature,
  checkBackendHealth,
  sanitizeInput,
  validateNetwork,
  createRateLimiter
};

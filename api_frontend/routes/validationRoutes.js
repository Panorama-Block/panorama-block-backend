const express = require('express');
const BackendService = require('../services/backendService');
const { 
  verifySignature, 
  checkBackendHealth,
  sanitizeInput,
  validateNetwork,
  createRateLimiter
} = require('../middleware/auth');

const router = express.Router();

// Rate limiting para rotas de validação
const validationRateLimiter = createRateLimiter(50, 15 * 60 * 1000); // 50 requests por 15 minutos

/**
 * @route GET /validation/info
 * @desc Obter informações do contrato de validação
 * @access Private (Smart Wallet)
 */
router.get('/info',
  verifySignature,
  checkBackendHealth,
  validationRateLimiter,
  async (req, res) => {
    try {
      const backendService = new BackendService();
      const result = await backendService.getValidationInfo(req.authData);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'BACKEND_ERROR',
            message: 'Erro ao obter informações do contrato de validação',
            details: result.error
          }
        });
      }

      res.json({
        success: true,
        data: {
          message: 'Informações do contrato de validação obtidas com sucesso',
          contract: result.data.data,
          network: process.env.NETWORK_NAME || 'Avalanche C-Chain',
          chainId: process.env.CHAIN_ID || '43114'
        }
      });

    } catch (error) {
      console.error('Erro ao obter informações do contrato:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao obter informações do contrato'
        }
      });
    }
  }
);

/**
 * @route POST /validation/calculate
 * @desc Calcular taxa de validação
 * @access Private (Smart Wallet)
 */
router.post('/calculate',
  verifySignature,
  checkBackendHealth,
  validationRateLimiter,
  sanitizeInput,
  validateNetwork,
  async (req, res) => {
    try {
      const { amount } = req.body;

      if (!amount) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'amount é obrigatório'
          }
        });
      }

      const backendService = new BackendService();
      const result = await backendService.calculateValidationTax(req.authData, amount);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'BACKEND_ERROR',
            message: 'Erro ao calcular taxa de validação',
            details: result.error
          }
        });
      }

      res.json({
        success: true,
        data: {
          message: 'Taxa de validação calculada com sucesso',
          calculation: result.data.data,
          amount,
          network: process.env.NETWORK_NAME || 'Avalanche C-Chain'
        }
      });

    } catch (error) {
      console.error('Erro ao calcular taxa de validação:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao calcular taxa de validação'
        }
      });
    }
  }
);

/**
 * @route POST /validation/pay
 * @desc Executar pagamento e validação (requer private key)
 * @access Private (Private Key)
 */
router.post('/pay',
  checkBackendHealth,
  validationRateLimiter,
  sanitizeInput,
  validateNetwork,
  async (req, res) => {
    try {
      const { privateKey, amount } = req.body;

      if (!privateKey || !amount) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'privateKey e amount são obrigatórios'
          }
        });
      }

      const backendService = new BackendService();
      const result = await backendService.payAndValidate(privateKey, amount);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'BACKEND_ERROR',
            message: 'Erro ao executar pagamento e validação',
            details: result.error
          }
        });
      }

      res.json({
        success: true,
        data: {
          message: 'Pagamento e validação executados com sucesso',
          transaction: result.data.data,
          amount,
          network: process.env.NETWORK_NAME || 'Avalanche C-Chain'
        }
      });

    } catch (error) {
      console.error('Erro ao executar pagamento e validação:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao executar pagamento e validação'
        }
      });
    }
  }
);

/**
 * @route GET /validation/status
 * @desc Obter status do sistema de validação
 * @access Public
 */
router.get('/status',
  checkBackendHealth,
  validationRateLimiter,
  async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          message: 'Sistema de validação operacional',
          status: 'active',
          network: process.env.NETWORK_NAME || 'Avalanche C-Chain',
          chainId: process.env.CHAIN_ID || '43114',
          features: [
            'Tax calculation',
            'Payment validation',
            'Smart wallet support',
            'Rate limiting'
          ]
        }
      });

    } catch (error) {
      console.error('Erro ao obter status do sistema:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao obter status do sistema'
        }
      });
    }
  }
);

/**
 * @route POST /validation/validate-lending
 * @desc Executar validação + lending (supply, redeem, borrow, repay)
 * @access Private (Private Key)
 */
router.post('/validate-lending',
  checkBackendHealth,
  validationRateLimiter,
  sanitizeInput,
  validateNetwork,
  async (req, res) => {
    try {
      const { 
        privateKey, 
        operation, 
        qTokenAddress, 
        amount, 
        isUnderlying = true 
      } = req.body;

      if (!privateKey || !operation || !qTokenAddress || !amount) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'privateKey, operation, qTokenAddress e amount são obrigatórios'
          }
        });
      }

      const validOperations = ['supply', 'redeem', 'borrow', 'repay'];
      if (!validOperations.includes(operation)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_OPERATION',
            message: `Operação inválida. Use uma das seguintes: ${validOperations.join(', ')}`
          }
        });
      }

      const backendService = new BackendService();
      let result;

      switch (operation) {
        case 'supply':
          result = await backendService.validateAndSupply(privateKey, qTokenAddress, amount);
          break;
        case 'redeem':
          result = await backendService.validateAndRedeem(privateKey, qTokenAddress, amount, isUnderlying);
          break;
        case 'borrow':
          result = await backendService.validateAndBorrow(privateKey, qTokenAddress, amount);
          break;
        case 'repay':
          result = await backendService.validateAndRepay(privateKey, qTokenAddress, amount);
          break;
      }

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'BACKEND_ERROR',
            message: `Erro ao executar validação + ${operation}`,
            details: result.error
          }
        });
      }

      res.json({
        success: true,
        data: {
          message: `Validação + ${operation} executado com sucesso`,
          operation,
          transaction: result.data.data,
          qTokenAddress,
          amount,
          network: process.env.NETWORK_NAME || 'Avalanche C-Chain'
        }
      });

    } catch (error) {
      console.error(`Erro ao executar validação + lending:`, error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao executar validação + lending'
        }
      });
    }
  }
);

module.exports = router;

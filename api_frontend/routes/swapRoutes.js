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

// Rate limiting para rotas de swap
const swapRateLimiter = createRateLimiter(150, 15 * 60 * 1000); // 150 requests por 15 minutos

/**
 * @route GET /swap/price
 * @desc Obter preço de swap entre dois tokens
 * @access Public
 */
router.get('/price',
  checkBackendHealth,
  swapRateLimiter,
  sanitizeInput,
  async (req, res) => {
    try {
      const { tokenIn, tokenOut, amount } = req.query;

      if (!tokenIn || !tokenOut || !amount) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'tokenIn, tokenOut e amount são obrigatórios'
          }
        });
      }

      const backendService = new BackendService();
      const result = await backendService.getSwapPrice(tokenIn, tokenOut, amount);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'BACKEND_ERROR',
            message: 'Erro ao obter preço do swap',
            details: result.error
          }
        });
      }

      res.json({
        success: true,
        data: {
          message: 'Preço do swap obtido com sucesso',
          price: result.data.data,
          tokenIn,
          tokenOut,
          amount
        }
      });

    } catch (error) {
      console.error('Erro ao obter preço do swap:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao obter preço do swap'
        }
      });
    }
  }
);


/**
 * @route GET /swap/tokens
 * @desc Lista tokens disponíveis para swap
 * @access Public
 */
router.get('/tokens',
  checkBackendHealth,
  swapRateLimiter,
  async (req, res) => {
    try {
      // Tokens principais da rede Avalanche
      const tokens = [
        {
          symbol: 'AVAX',
          address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
          name: 'Avalanche',
          decimals: 18,
          logo: 'https://cryptologos.cc/logos/avalanche-avax-logo.png'
        },
        {
          symbol: 'USDC',
          address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
          name: 'USD Coin',
          decimals: 6,
          logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
        },
        {
          symbol: 'USDT',
          address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
          name: 'Tether USD',
          decimals: 6,
          logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
        },
        {
          symbol: 'WETH',
          address: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
          name: 'Wrapped Ethereum',
          decimals: 18,
          logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
        },
        {
          symbol: 'DAI',
          address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70',
          name: 'Dai Stablecoin',
          decimals: 18,
          logo: 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png'
        },
        {
          symbol: 'JOE',
          address: '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd',
          name: 'Joe Token',
          decimals: 18,
          logo: 'https://cryptologos.cc/logos/trader-joe-joe-logo.png'
        }
      ];

      res.json({
        success: true,
        data: {
          message: 'Tokens disponíveis listados com sucesso',
          tokens,
          total: tokens.length
        }
      });

    } catch (error) {
      console.error('Erro ao listar tokens:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao listar tokens'
        }
      });
    }
  }
);

/**
 * @route GET /swap/quote
 * @desc Obter cotação completa de swap (preço + gas)
 * @access Public
 */
router.get('/quote',
  checkBackendHealth,
  swapRateLimiter,
  sanitizeInput,
  async (req, res) => {
    try {
      const { tokenIn, tokenOut, amount } = req.query;

      if (!tokenIn || !tokenOut || !amount) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'tokenIn, tokenOut e amount são obrigatórios'
          }
        });
      }

      const backendService = new BackendService();
      const result = await backendService.getSwapPrice(tokenIn, tokenOut, amount);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'BACKEND_ERROR',
            message: 'Erro ao obter cotação do swap',
            details: result.error
          }
        });
      }

      // Adicionar informações extras para a cotação
      const quote = {
        ...result.data.data,
        estimatedGas: '300000', // Gas estimado para swap
        slippage: '0.5%', // Slippage padrão
        network: process.env.NETWORK_NAME || 'Avalanche C-Chain',
        chainId: process.env.CHAIN_ID || '43114'
      };

      res.json({
        success: true,
        data: {
          message: 'Cotação do swap obtida com sucesso',
          quote,
          tokenIn,
          tokenOut,
          amount
        }
      });

    } catch (error) {
      console.error('Erro ao obter cotação do swap:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao obter cotação do swap'
        }
      });
    }
  }
);

/**
 * @route POST /swap/validate-quote
 * @desc Obter cotação de validação + swap
 * @access Private (Smart Wallet)
 */
router.post('/validate-quote',
  verifySignature,
  checkBackendHealth,
  swapRateLimiter,
  sanitizeInput,
  validateNetwork,
  async (req, res) => {
    try {
      const { tokenIn, tokenOut, amountIn } = req.body;

      if (!tokenIn || !tokenOut || !amountIn) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'tokenIn, tokenOut e amountIn são obrigatórios'
          }
        });
      }

      const backendService = new BackendService();
      const result = await backendService.getValidationAndSwapQuote(
        req.authData,
        tokenIn,
        tokenOut,
        amountIn
      );

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'BACKEND_ERROR',
            message: 'Erro ao obter cotação de validação + swap',
            details: result.error
          }
        });
      }

      res.json({
        success: true,
        data: {
          message: 'Cotação de validação + swap obtida com sucesso',
          quote: result.data.data,
          tokenIn,
          tokenOut,
          amountIn,
          network: process.env.NETWORK_NAME || 'Avalanche C-Chain'
        }
      });

    } catch (error) {
      console.error('Erro ao obter cotação de validação + swap:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao obter cotação de validação + swap'
        }
      });
    }
  }
);

/**
 * @route POST /swap/validate-swap
 * @desc Preparar transação de validação + swap
 * @access Private (Smart Wallet)
 */
router.post('/validate-swap',
  verifySignature,
  checkBackendHealth,
  swapRateLimiter,
  sanitizeInput,
  validateNetwork,
  async (req, res) => {
    try {
      const { 
        tokenIn, 
        tokenOut, 
        amountIn, 
        minAmountOut 
      } = req.body;

      if (!tokenIn || !tokenOut || !amountIn || !minAmountOut) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'tokenIn, tokenOut, amountIn e minAmountOut são obrigatórios'
          }
        });
      }

      const backendService = new BackendService();
      const result = await backendService.prepareValidationAndSwap(
        req.authData,
        tokenIn,
        tokenOut,
        amountIn,
        minAmountOut
      );

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'BACKEND_ERROR',
            message: 'Erro ao preparar transação de validação + swap',
            details: result.error
          }
        });
      }

      res.json({
        success: true,
        data: {
          message: 'Transação de validação + swap preparada com sucesso',
          operation: 'prepareValidationAndSwap',
          transaction: result.data.data,
          tokenIn,
          tokenOut,
          amountIn,
          minAmountOut,
          network: process.env.NETWORK_NAME || 'Avalanche C-Chain'
        }
      });

    } catch (error) {
      console.error('Erro ao preparar transação de validação + swap:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao preparar transação de validação + swap'
        }
      });
    }
  }
);

module.exports = router;

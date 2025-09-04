const express = require('express');
const { ethers } = require('ethers');
const TraderJoeService = require('../services/traderJoeService');
const { 
  verifySignature, 
  createRateLimiter,
  validateNetwork,
  sanitizeInput
} = require('../middleware/auth');
const { NETWORKS, TRADER_JOE } = require('../config/constants');

const router = express.Router();

// Rate limiting para rotas do Trader Joe
const traderJoeRateLimiter = createRateLimiter(100, 15 * 60 * 1000); // 100 requests por 15 minutos

/**
 * @route GET /getprice
 * @desc Returns the swap quotation for the given token pair
 * @access Public (com assinatura)
 */
router.get('/getprice', 
  verifySignature, 
  traderJoeRateLimiter,
  async (req, res) => {
    try {
      const { rpc, dexId, path, amountIn } = req.query;
      
      // Validação dos parâmetros obrigatórios
      if (!dexId || !path || !amountIn) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'dexId, path e amountIn são obrigatórios'
          }
        });
      }

      // Validação do dexId (deve ser 2100 para Trader Joe)
      if (dexId !== '2100') {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'dexId deve ser 2100 para Trader Joe'
          }
        });
      }

      // Parse do path (comma separated values)
      const tokenPath = path.split(',').map(addr => addr.trim());
      
      if (tokenPath.length < 2) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'path deve conter pelo menos 2 endereços de token'
          }
        });
      }

      // Usa RPC fornecido ou padrão
      const rpcUrl = rpc || NETWORKS.AVALANCHE.rpcUrl;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const traderJoeService = new TraderJoeService(provider);

      // Obtém o preço usando o primeiro e último token do path
      const tokenIn = tokenPath[0];
      const tokenOut = tokenPath[tokenPath.length - 1];
      
      const price = await traderJoeService.getPrice(tokenIn, tokenOut, amountIn);
      
      res.json({
        status: 200,
        msg: 'success',
        data: {
          amountIn: price.amountIn,
          path: tokenPath,
          amountsOut: price.amountOut
        }
      });
    } catch (error) {
      console.error('Erro ao obter preço:', error);
      res.status(500).json({
        status: 500,
        msg: 'error',
        data: {
          error: 'Erro ao obter preço',
          details: error.message
        }
      });
    }
  }
);

/**
 * @route GET /getuserliquidity
 * @desc Returns the balance of a particular token pair of an account
 * @access Public (com assinatura)
 */
router.get('/getuserliquidity', 
  verifySignature, 
  traderJoeRateLimiter,
  async (req, res) => {
    try {
      const { rpc, tokenA, dexId, tokenB, address, id } = req.query;
      
      // Validação dos parâmetros obrigatórios
      if (!tokenA || !dexId || !tokenB || !address || !id) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'tokenA, dexId, tokenB, address e id são obrigatórios'
          }
        });
      }

      // Validação do dexId
      if (dexId !== '2100') {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'dexId deve ser 2100 para Trader Joe'
          }
        });
      }

      // Usa RPC fornecido ou padrão
      const rpcUrl = rpc || NETWORKS.AVALANCHE.rpcUrl;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const traderJoeService = new TraderJoeService(provider);

      // Obtém informações de liquidez do usuário
      // Nota: Esta é uma implementação simplificada
      // Em produção, você precisaria integrar com a API do Trader Joe para obter dados reais de liquidez
      const liquidityInfo = await traderJoeService.getUserLiquidity(tokenA, tokenB, address, id);
      
      res.json({
        status: 200,
        msg: 'success',
        data: liquidityInfo
      });
    } catch (error) {
      console.error('Erro ao obter liquidez do usuário:', error);
      res.status(500).json({
        status: 500,
        msg: 'error',
        data: {
          error: 'Erro ao obter liquidez do usuário',
          details: error.message
        }
      });
    }
  }
);

/**
 * @route GET /getpoolliquidity
 * @desc Returns the total liquidity for a specified pool
 * @access Public (com assinatura)
 */
router.get('/getpoolliquidity', 
  verifySignature, 
  traderJoeRateLimiter,
  async (req, res) => {
    try {
      const { rpc, poolAddress, dexId, id } = req.query;
      
      // Validação dos parâmetros obrigatórios
      if (!poolAddress || !dexId || !id) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'poolAddress, dexId e id são obrigatórios'
          }
        });
      }

      // Validação do dexId
      if (dexId !== '2100') {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'dexId deve ser 2100 para Trader Joe'
          }
        });
      }

      // Usa RPC fornecido ou padrão
      const rpcUrl = rpc || NETWORKS.AVALANCHE.rpcUrl;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const traderJoeService = new TraderJoeService(provider);

      // Obtém liquidez total do pool
      const poolLiquidity = await traderJoeService.getPoolLiquidity(poolAddress, id);
      
      res.json({
        status: 200,
        msg: 'success',
        data: poolLiquidity
      });
    } catch (error) {
      console.error('Erro ao obter liquidez do pool:', error);
      res.status(500).json({
        status: 500,
        msg: 'error',
        data: {
          error: 'Erro ao obter liquidez do pool',
          details: error.message
        }
      });
    }
  }
);

/**
 * @route GET /gettokenliquidity
 * @desc Returns the individual token liquidity within the specified liquidity pool
 * @access Public (com assinatura)
 */
router.get('/gettokenliquidity', 
  verifySignature, 
  traderJoeRateLimiter,
  async (req, res) => {
    try {
      const { rpc, poolAddress, dexId } = req.query;
      
      // Validação dos parâmetros obrigatórios
      if (!poolAddress || !dexId) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'poolAddress e dexId são obrigatórios'
          }
        });
      }

      // Validação do dexId
      if (dexId !== '2100') {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'dexId deve ser 2100 para Trader Joe'
          }
        });
      }

      // Usa RPC fornecido ou padrão
      const rpcUrl = rpc || NETWORKS.AVALANCHE.rpcUrl;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const traderJoeService = new TraderJoeService(provider);

      // Obtém liquidez individual dos tokens
      const tokenLiquidity = await traderJoeService.getTokenLiquidity(poolAddress);
      
      res.json({
        status: 200,
        msg: 'success',
        data: tokenLiquidity
      });
    } catch (error) {
      console.error('Erro ao obter liquidez dos tokens:', error);
      res.status(500).json({
        status: 500,
        msg: 'error',
        data: {
          error: 'Erro ao obter liquidez dos tokens',
          details: error.message
        }
      });
    }
  }
);

/**
 * @route POST /swap
 * @desc Initiate a swap transaction on a specified DEX
 * @access Private (com transação assinada)
 */
router.post('/swap', 
  verifySignature, 
  traderJoeRateLimiter,
  validateNetwork(NETWORKS.AVALANCHE),
  sanitizeInput,
  async (req, res) => {
    try {
      const { 
        dexId, 
        path, 
        amountIn, 
        amountOutMin, 
        to, 
        from, 
        gas, 
        rpc, 
        gasPriority, 
        slippage, 
        deadline,
        signedTransaction 
      } = req.body;
      
      // Validação dos parâmetros obrigatórios
      if (!dexId || !path || !amountIn || !amountOutMin || !to || !from || !deadline) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'dexId, path, amountIn, amountOutMin, to, from e deadline são obrigatórios'
          }
        });
      }

      // Validação do dexId
      if (dexId !== '2100') {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'dexId deve ser 2100 para Trader Joe'
          }
        });
      }

      // Validação da transação assinada
      if (!signedTransaction) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'signedTransaction é obrigatória'
          }
        });
      }

      // Usa RPC fornecido ou padrão
      const rpcUrl = rpc || NETWORKS.AVALANCHE.rpcUrl;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const traderJoeService = new TraderJoeService(provider);

      // Executa o swap
      const swapResult = await traderJoeService.executeSwap({
        path,
        amountIn,
        amountOutMin,
        to,
        from,
        gas,
        gasPriority,
        slippage,
        deadline,
        signedTransaction
      });
      
      res.json({
        status: 200,
        msg: 'success',
        data: swapResult
      });
    } catch (error) {
      console.error('Erro ao executar swap:', error);
      res.status(500).json({
        status: 500,
        msg: 'error',
        data: {
          error: 'Erro ao executar swap',
          details: error.message
        }
      });
    }
  }
);

/**
 * @route POST /addliquidity
 * @desc Add liquidity to a specified pool in a specified DEX
 * @access Private (com transação assinada)
 */
router.post('/addliquidity', 
  verifySignature, 
  traderJoeRateLimiter,
  validateNetwork(NETWORKS.AVALANCHE),
  sanitizeInput,
  async (req, res) => {
    try {
      const { 
        dexId, 
        tokenA, 
        tokenB, 
        amountA, 
        amountB, 
        amountAMin, 
        amountBMin, 
        deadline, 
        to, 
        from, 
        gas, 
        rpc, 
        gasPriority, 
        slippage, 
        strategy,
        signedTransaction 
      } = req.body;
      
      // Validação dos parâmetros obrigatórios
      if (!dexId || !tokenA || !tokenB || !amountA || !amountB || !amountAMin || !amountBMin || !deadline || !to || !from) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'Todos os parâmetros obrigatórios devem ser fornecidos'
          }
        });
      }

      // Validação do dexId
      if (dexId !== '2100') {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'dexId deve ser 2100 para Trader Joe'
          }
        });
      }

      // Validação da transação assinada
      if (!signedTransaction) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'signedTransaction é obrigatória'
          }
        });
      }

      // Usa RPC fornecido ou padrão
      const rpcUrl = rpc || NETWORKS.AVALANCHE.rpcUrl;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const traderJoeService = new TraderJoeService(provider);

      // Adiciona liquidez
      const addLiquidityResult = await traderJoeService.addLiquidity({
        tokenA,
        tokenB,
        amountA,
        amountB,
        amountAMin,
        amountBMin,
        deadline,
        to,
        from,
        gas,
        gasPriority,
        slippage,
        strategy,
        signedTransaction
      });
      
      res.json({
        status: 200,
        msg: 'success',
        data: addLiquidityResult
      });
    } catch (error) {
      console.error('Erro ao adicionar liquidez:', error);
      res.status(500).json({
        status: 500,
        msg: 'error',
        data: {
          error: 'Erro ao adicionar liquidez',
          details: error.message
        }
      });
    }
  }
);

/**
 * @route POST /removeliquidity
 * @desc Remove liquidity from a specified pool for a specified DEX
 * @access Private (com transação assinada)
 */
router.post('/removeliquidity', 
  verifySignature, 
  traderJoeRateLimiter,
  validateNetwork(NETWORKS.AVALANCHE),
  sanitizeInput,
  async (req, res) => {
    try {
      const { 
        dexId, 
        amountAMin, 
        deadline, 
        from, 
        gas, 
        rpc, 
        tokenA, 
        tokenB, 
        amountBMin, 
        gasPriority, 
        binStep, 
        ids, 
        amounts, 
        to, 
        slippage,
        signedTransaction 
      } = req.body;
      
      // Validação dos parâmetros obrigatórios
      if (!dexId || !amountAMin || !deadline || !from || !tokenA || !tokenB || !amountBMin || !binStep || !ids || !amounts || !to) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'Todos os parâmetros obrigatórios devem ser fornecidos'
          }
        });
      }

      // Validação do dexId
      if (dexId !== '2100') {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'dexId deve ser 2100 para Trader Joe'
          }
        });
      }

      // Validação da transação assinada
      if (!signedTransaction) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'signedTransaction é obrigatória'
          }
        });
      }

      // Usa RPC fornecido ou padrão
      const rpcUrl = rpc || NETWORKS.AVALANCHE.rpcUrl;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const traderJoeService = new TraderJoeService(provider);

      // Remove liquidez
      const removeLiquidityResult = await traderJoeService.removeLiquidity({
        tokenA,
        tokenB,
        amountAMin,
        amountBMin,
        deadline,
        to,
        from,
        gas,
        gasPriority,
        binStep,
        ids,
        amounts,
        slippage,
        signedTransaction
      });
      
      res.json({
        status: 200,
        msg: 'success',
        data: removeLiquidityResult
      });
    } catch (error) {
      console.error('Erro ao remover liquidez:', error);
      res.status(500).json({
        status: 500,
        msg: 'error',
        data: {
          error: 'Erro ao remover liquidez',
          details: error.message
        }
      });
    }
  }
);

module.exports = router;

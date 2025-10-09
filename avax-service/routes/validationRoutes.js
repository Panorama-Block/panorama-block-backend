const express = require('express');
const { ethers } = require('ethers');
const ValidationService = require('../services/validationService');
const { 
  verifySignature, 
  createRateLimiter,
  validateNetwork,
  sanitizeInput
} = require('../middleware/auth');
const { NETWORKS, VALIDATION } = require('../config/constants');

const router = express.Router();

// Rate limiting para rotas do Validation
const validationRateLimiter = createRateLimiter(50, 15 * 60 * 1000); // 50 requests por 15 minutos

/**
 * @route GET /info
 * @desc Retorna informações do contrato Validation
 * @access Public (com autenticação)
 * 
 * COMO CHAMAR:
 * GET /validation/info
 * 
 * Headers: Content-Type: application/json
 * Body: {
 *   "address": "0x1234567890abcdef1234567890abcdef12345678",
 *   "signature": "0xabcd...",
 *   "message": "Get validation info\nTimestamp: 1234567890",
 *   "timestamp": 1234567890
 * }
 * 
 * Exemplo de resposta:
 * {
 *   "status": 200,
 *   "msg": "success",
 *   "data": {
 *     "owner": "0x1234567890abcdef1234567890abcdef12345678",
 *     "taxRate": "10",
 *     "contractAddress": "0x...",
 *     "network": "Avalanche C-Chain",
 *     "chainId": "43114"
 *   }
 * }
 */
router.get('/info', 
  verifySignature, 
  validationRateLimiter,
  async (req, res) => {
    try {
      const rpcUrl = req.body.rpc || NETWORKS.AVALANCHE.rpcUrl;
      const provider = new ethers.JsonRpcProvider(rpcUrl, {
        name: 'avalanche',
        chainId: 43114
      }, {
        staticNetwork: true
      });

      const validationService = new ValidationService(provider);
      const contractInfo = await validationService.getContractInfo();
      
      res.json({
        status: 200,
        msg: 'success',
        data: contractInfo
      });
    } catch (error) {
      console.error('Erro ao obter informações do contrato:', error);
      res.status(500).json({
        status: 500,
        msg: 'error',
        data: {
          error: 'Erro ao obter informações do contrato',
          details: error.message
        }
      });
    }
  }
);

/**
 * @route POST /calculate
 * @desc Calcula o valor da taxa para um montante específico
 * @access Public (com autenticação)
 * 
 * COMO CHAMAR:
 * POST /validation/calculate
 * 
 * Headers: Content-Type: application/json
 * Body: {
 *   "address": "0x1234567890abcdef1234567890abcdef12345678",
 *   "signature": "0xabcd...",
 *   "message": "Calculate tax\nTimestamp: 1234567890",
 *   "timestamp": 1234567890,
 *   "amount": "1000000000000000000"
 * }
 * 
 * Parâmetros:
 * - amount: Montante em wei para calcular a taxa
 * - rpc: (opcional) URL do RPC customizado
 * 
 * Exemplo de resposta:
 * {
 *   "status": 200,
 *   "msg": "success",
 *   "data": {
 *     "amount": "1000000000000000000",
 *     "taxAmount": "100000000000000000",
 *     "taxRate": "10",
 *     "restAmount": "900000000000000000"
 *   }
 * }
 */
router.post('/calculate', 
  verifySignature, 
  validationRateLimiter,
  sanitizeInput,
  async (req, res) => {
    try {
      const { amount, rpc } = req.body;
      
      // Validação dos parâmetros obrigatórios
      if (!amount) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'amount é obrigatório'
          }
        });
      }

      // Valida o formato do amount
      if (!/^\d+$/.test(amount)) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'amount deve ser um número inteiro em wei'
          }
        });
      }

      const rpcUrl = rpc || NETWORKS.AVALANCHE.rpcUrl;
      const provider = new ethers.JsonRpcProvider(rpcUrl, {
        name: 'avalanche',
        chainId: 43114
      }, {
        staticNetwork: true
      });

      const validationService = new ValidationService(provider);
      
      // Obtém informações do contrato e calcula taxa
      const [contractInfo, taxAmount] = await Promise.all([
        validationService.getContractInfo(),
        validationService.calculateTax(amount)
      ]);

      const restAmount = (BigInt(amount) - BigInt(taxAmount)).toString();

      res.json({
        status: 200,
        msg: 'success',
        data: {
          amount: amount,
          taxAmount: taxAmount,
          taxRate: contractInfo.taxRate,
          restAmount: restAmount
        }
      });
    } catch (error) {
      console.error('Erro ao calcular taxa:', error);
      res.status(500).json({
        status: 500,
        msg: 'error',
        data: {
          error: 'Erro ao calcular taxa',
          details: error.message
        }
      });
    }
  }
);

/**
 * @route POST /setTaxRate
 * @desc Define nova taxa do contrato (apenas owner)
 * @access Private (com transação assinada)
 * 
 * COMO CHAMAR:
 * POST /validation/setTaxRate
 * 
 * Headers: Content-Type: application/json
 * Body: {
 *   "address": "0x1234567890abcdef1234567890abcdef12345678",
 *   "signature": "0xabcd...",
 *   "message": "Set tax rate\nTimestamp: 1234567890",
 *   "timestamp": 1234567890,
 *   "newTaxRate": "15",
 *   "privateKey": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
 * }
 * 
 * Parâmetros obrigatórios:
 * - newTaxRate: Nova taxa (0-100)
 * - privateKey: Private key do owner
 * 
 * Parâmetros opcionais:
 * - rpc: URL do RPC customizado
 * 
 * Exemplo de resposta:
 * {
 *   "status": 200,
 *   "msg": "success",
 *   "data": {
 *     "transactionHash": "0x...",
 *     "status": "pending",
 *     "gasEstimate": "50000",
 *     "newTaxRate": "15"
 *   }
 * }
 */
router.post('/setTaxRate', 
  verifySignature, 
  validationRateLimiter,
  validateNetwork(NETWORKS.AVALANCHE),
  sanitizeInput,
  async (req, res) => {
    try {
      const { newTaxRate, privateKey, rpc } = req.body;
      
      // Validação dos parâmetros obrigatórios
      if (!newTaxRate || !privateKey) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'newTaxRate e privateKey são obrigatórios'
          }
        });
      }

      // Valida a taxa
      const taxRate = parseInt(newTaxRate);
      if (taxRate < 0 || taxRate > VALIDATION.MAX_TAX_RATE) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: `Taxa deve estar entre 0 e ${VALIDATION.MAX_TAX_RATE}`
          }
        });
      }

      const rpcUrl = rpc || NETWORKS.AVALANCHE.rpcUrl;
      const provider = new ethers.JsonRpcProvider(rpcUrl, {
        name: 'avalanche',
        chainId: 43114
      }, {
        staticNetwork: true
      });

      const validationService = new ValidationService(provider);
      const result = await validationService.setTaxRate(newTaxRate, privateKey);
      
      res.json({
        status: 200,
        msg: 'success',
        data: result
      });
    } catch (error) {
      console.error('Erro ao definir taxa:', error);
      res.status(500).json({
        status: 500,
        msg: 'error',
        data: {
          error: 'Erro ao definir taxa',
          details: error.message
        }
      });
    }
  }
);

/**
 * @route POST /payAndValidate
 * @desc Executa pagamento e validação (função payable)
 * @access Private (com transação assinada)
 * 
 * COMO CHAMAR:
 * POST /validation/payAndValidate
 * 
 * Headers: Content-Type: application/json
 * Body: {
 *   "address": "0x1234567890abcdef1234567890abcdef12345678",
 *   "signature": "0xabcd...",
 *   "message": "Pay and validate\nTimestamp: 1234567890",
 *   "timestamp": 1234567890,
 *   "amount": "1000000000000000000",
 *   "privateKey": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
 * }
 * 
 * Parâmetros obrigatórios:
 * - amount: Montante em wei a ser enviado
 * - privateKey: Private key do usuário
 * 
 * Parâmetros opcionais:
 * - rpc: URL do RPC customizado
 * 
 * Exemplo de resposta:
 * {
 *   "status": 200,
 *   "msg": "success",
 *   "data": {
 *     "transactionHash": "0x...",
 *     "status": "success",
 *     "blockNumber": "12345678",
 *     "gasUsed": "50000",
 *     "amountSent": "1000000000000000000",
 *     "taxAmount": "100000000000000000",
 *     "restAmount": "900000000000000000"
 *   }
 * }
 */
router.post('/payAndValidate', 
  verifySignature, 
  validationRateLimiter,
  validateNetwork(NETWORKS.AVALANCHE),
  sanitizeInput,
  async (req, res) => {
    try {
      const { amount, privateKey, rpc } = req.body;
      
      // Validação dos parâmetros obrigatórios
      if (!amount || !privateKey) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'amount e privateKey são obrigatórios'
          }
        });
      }

      // Valida o formato do amount
      if (!/^\d+$/.test(amount)) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'amount deve ser um número inteiro em wei'
          }
        });
      }

      const rpcUrl = rpc || NETWORKS.AVALANCHE.rpcUrl;
      const provider = new ethers.JsonRpcProvider(rpcUrl, {
        name: 'avalanche',
        chainId: 43114
      }, {
        staticNetwork: true
      });

      const validationService = new ValidationService(provider);
      const result = await validationService.payAndValidate(amount, privateKey);
      
      res.json({
        status: 200,
        msg: 'success',
        data: result
      });
    } catch (error) {
      console.error('Erro ao executar pagamento:', error);
      res.status(500).json({
        status: 500,
        msg: 'error',
        data: {
          error: 'Erro ao executar pagamento',
          details: error.message
        }
      });
    }
  }
);

/**
 * @route POST /withdraw
 * @desc Retira fundos do contrato (apenas owner)
 * @access Private (com transação assinada)
 * 
 * COMO CHAMAR:
 * POST /validation/withdraw
 * 
 * Headers: Content-Type: application/json
 * Body: {
 *   "address": "0x1234567890abcdef1234567890abcdef12345678",
 *   "signature": "0xabcd...",
 *   "message": "Withdraw funds\nTimestamp: 1234567890",
 *   "timestamp": 1234567890,
 *   "privateKey": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
 * }
 * 
 * Parâmetros obrigatórios:
 * - privateKey: Private key do owner
 * 
 * Parâmetros opcionais:
 * - rpc: URL do RPC customizado
 * 
 * Exemplo de resposta:
 * {
 *   "status": 200,
 *   "msg": "success",
 *   "data": {
 *     "transactionHash": "0x...",
 *     "status": "success",
 *     "blockNumber": "12345678",
 *     "gasUsed": "50000",
 *     "amountWithdrawn": "1000000000000000000"
 *   }
 * }
 */
router.post('/withdraw', 
  verifySignature, 
  validationRateLimiter,
  validateNetwork(NETWORKS.AVALANCHE),
  sanitizeInput,
  async (req, res) => {
    try {
      const { privateKey, rpc } = req.body;
      
      // Validação dos parâmetros obrigatórios
      if (!privateKey) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'privateKey é obrigatório'
          }
        });
      }

      const rpcUrl = rpc || NETWORKS.AVALANCHE.rpcUrl;
      const provider = new ethers.JsonRpcProvider(rpcUrl, {
        name: 'avalanche',
        chainId: 43114
      }, {
        staticNetwork: true
      });

      const validationService = new ValidationService(provider);
      const result = await validationService.withdraw(privateKey);
      
      res.json({
        status: 200,
        msg: 'success',
        data: result
      });
    } catch (error) {
      console.error('Erro ao retirar fundos:', error);
      res.status(500).json({
        status: 500,
        msg: 'error',
        data: {
          error: 'Erro ao retirar fundos',
          details: error.message
        }
      });
    }
  }
);

/**
 * @route GET /balance
 * @desc Obtém saldo do contrato
 * @access Public (com autenticação)
 * 
 * COMO CHAMAR:
 * GET /validation/balance
 * 
 * Headers: Content-Type: application/json
 * Body: {
 *   "address": "0x1234567890abcdef1234567890abcdef12345678",
 *   "signature": "0xabcd...",
 *   "message": "Get contract balance\nTimestamp: 1234567890",
 *   "timestamp": 1234567890
 * }
 * 
 * Parâmetros opcionais:
 * - rpc: URL do RPC customizado
 * 
 * Exemplo de resposta:
 * {
 *   "status": 200,
 *   "msg": "success",
 *   "data": {
 *     "balance": "1000000000000000000",
 *     "balanceFormatted": "1.0",
 *     "contractAddress": "0x...",
 *     "network": "Avalanche C-Chain"
 *   }
 * }
 */
router.get('/balance', 
  verifySignature, 
  validationRateLimiter,
  async (req, res) => {
    try {
      const { rpc } = req.body;
      
      const rpcUrl = rpc || NETWORKS.AVALANCHE.rpcUrl;
      const provider = new ethers.JsonRpcProvider(rpcUrl, {
        name: 'avalanche',
        chainId: 43114
      }, {
        staticNetwork: true
      });

      const validationService = new ValidationService(provider);
      const balance = await validationService.getContractBalance();
      
      // Converte para formato legível
      const balanceFormatted = ethers.formatEther(balance);
      
      res.json({
        status: 200,
        msg: 'success',
        data: {
          balance: balance,
          balanceFormatted: balanceFormatted,
          contractAddress: VALIDATION.CONTRACT_ADDRESS,
          network: NETWORKS.AVALANCHE.name
        }
      });
    } catch (error) {
      console.error('Erro ao obter saldo:', error);
      res.status(500).json({
        status: 500,
        msg: 'error',
        data: {
          error: 'Erro ao obter saldo do contrato',
          details: error.message
        }
      });
    }
  }
);

/**
 * @route POST /prepare
 * @desc Prepara dados de transação para assinatura no frontend
 * @access Public (com autenticação)
 * 
 * COMO CHAMAR:
 * POST /validation/prepare
 * 
 * Headers: Content-Type: application/json
 * Body: {
 *   "address": "0x1234567890abcdef1234567890abcdef12345678",
 *   "signature": "0xabcd...",
 *   "message": "Prepare transaction\nTimestamp: 1234567890",
 *   "timestamp": 1234567890,
 *   "functionName": "setTaxRate",
 *   "params": ["15"]
 * }
 * 
 * Parâmetros obrigatórios:
 * - functionName: Nome da função (setTaxRate, payAndValidate, withdraw)
 * - params: Array com parâmetros da função
 * 
 * Parâmetros opcionais:
 * - rpc: URL do RPC customizado
 * 
 * Exemplo de resposta:
 * {
 *   "status": 200,
 *   "msg": "success",
 *   "data": {
 *     "to": "0x...",
 *     "data": "0x...",
 *     "value": "0",
 *     "gas": "100000",
 *     "gasPrice": "30000000000",
 *     "chainId": "43114",
 *     "functionName": "setTaxRate",
 *     "params": ["15"]
 *   }
 * }
 */
router.post('/prepare', 
  verifySignature, 
  validationRateLimiter,
  sanitizeInput,
  async (req, res) => {
    try {
      const { functionName, params, rpc } = req.body;
      
      // Validação dos parâmetros obrigatórios
      if (!functionName) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'functionName é obrigatório'
          }
        });
      }

      // Valida se a função é suportada
      const supportedFunctions = ['setTaxRate', 'payAndValidate', 'withdraw'];
      if (!supportedFunctions.includes(functionName)) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: `Função ${functionName} não suportada`,
            supportedFunctions: supportedFunctions
          }
        });
      }

      const rpcUrl = rpc || NETWORKS.AVALANCHE.rpcUrl;
      const provider = new ethers.JsonRpcProvider(rpcUrl, {
        name: 'avalanche',
        chainId: 43114
      }, {
        staticNetwork: true
      });

      const validationService = new ValidationService(provider);
      const transactionData = await validationService.prepareTransaction(functionName, params || []);
      
      res.json({
        status: 200,
        msg: 'success',
        data: transactionData
      });
    } catch (error) {
      console.error('Erro ao preparar transação:', error);
      res.status(500).json({
        status: 500,
        msg: 'error',
        data: {
          error: 'Erro ao preparar transação',
          details: error.message
        }
      });
    }
  }
);

module.exports = router;

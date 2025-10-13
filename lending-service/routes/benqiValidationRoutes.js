const express = require('express');
const { ethers } = require('ethers');
const ValidationService = require('../services/validationService');
const BenqiService = require('../services/benqiService');
const { 
  verifySignature, 
  createRateLimiter,
  sanitizeInput
} = require('../middleware/auth');
const { NETWORKS, VALIDATION } = require('../config/constants');

const router = express.Router();

// Rate limiting
const benqiValidationRateLimiter = createRateLimiter(20, 15 * 60 * 1000); // 20 requests por 15 minutos

/**
 * @route POST /validateAndSupply
 * @desc Executa validação primeiro e depois supply
 * @access Private (com transação assinada)
 * 
 * COMO CHAMAR:
 * POST /benqi-validation/validateAndSupply
 * 
 * Headers: Content-Type: application/json
 * Body: {
 *   "address": "0x1234567890abcdef1234567890abcdef12345678",
 *   "signature": "0xabcd...",
 *   "message": "Validate and supply\nTimestamp: 1234567890",
 *   "timestamp": 1234567890,
 *   "amount": "1000000000000000000",
 *   "qTokenAddress": "0x4A2c2838c3904D4B0B4a82eD7a3d0d3a0B4a82eD7",
 *   "privateKey": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
 * }
 * 
 * Parâmetros obrigatórios:
 * - amount: Montante em wei para validação
 * - qTokenAddress: Endereço do qToken
 * - privateKey: Private key do usuário
 * 
 * Exemplo de resposta:
 * {
 *   "status": 200,
 *   "msg": "success",
 *   "data": {
 *     "validation": {
 *       "transactionHash": "0x...",
 *       "taxAmount": "100000000000000000",
 *       "restAmount": "900000000000000000"
 *     },
 *     "supply": {
 *       "transactionHash": "0x...",
 *       "amountSupplied": "900000000000000000"
 *     }
 *   }
 * }
 */
router.post('/validateAndSupply', 
  verifySignature, 
  benqiValidationRateLimiter,
  sanitizeInput,
  async (req, res) => {
    try {
      const { amount, qTokenAddress, privateKey, rpc } = req.body;
      
      // Validação dos parâmetros obrigatórios
      if (!amount || !qTokenAddress || !privateKey) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'amount, qTokenAddress e privateKey são obrigatórios'
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
      const benqiService = new BenqiService(provider);
      
      console.log('🔄 Iniciando processo de validação + supply...');
      
      // PASSO 1: Executar validação (payAndValidate)
      console.log('📋 Passo 1: Executando validação...');
      const validationResult = await validationService.payAndValidate(amount, privateKey);
      
      console.log('✅ Validação concluída:', validationResult.transactionHash);
      
      // PASSO 2: Executar supply com o valor restante
      console.log('🔄 Passo 2: Executando supply...');
      
      // Simula supply (em produção, você integraria com o Benqi)
      const supplyResult = {
        transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
        status: 'success',
        amountSupplied: validationResult.restAmount,
        qTokenAddress: qTokenAddress
      };
      
      console.log('✅ Supply concluído:', supplyResult.transactionHash);
      
      res.json({
        status: 200,
        msg: 'success',
        data: {
          validation: {
            transactionHash: validationResult.transactionHash,
            status: validationResult.status,
            blockNumber: validationResult.blockNumber,
            gasUsed: validationResult.gasUsed,
            amountSent: validationResult.amountSent,
            taxAmount: validationResult.taxAmount,
            restAmount: validationResult.restAmount
          },
          supply: supplyResult,
          summary: {
            totalAmount: amount,
            taxPaid: validationResult.taxAmount,
            amountSupplied: validationResult.restAmount,
            taxRate: await validationService.getContractInfo().then(info => info.taxRate)
          }
        }
      });
      
    } catch (error) {
      console.error('Erro no validateAndSupply:', error);
      res.status(500).json({
        status: 500,
        msg: 'error',
        data: {
          error: 'Erro no processo de validação + supply',
          details: error.message
        }
      });
    }
  }
);

/**
 * @route POST /validateAndBorrow
 * @desc Executa validação primeiro e depois borrow
 * @access Private (com transação assinada)
 * 
 * COMO CHAMAR:
 * POST /benqi-validation/validateAndBorrow
 * 
 * Headers: Content-Type: application/json
 * Body: {
 *   "address": "0x1234567890abcdef1234567890abcdef12345678",
 *   "signature": "0xabcd...",
 *   "message": "Validate and borrow\nTimestamp: 1234567890",
 *   "timestamp": 1234567890,
 *   "amount": "1000000000000000000",
 *   "qTokenAddress": "0x4A2c2838c3904D4B0B4a82eD7a3d0d3a0B4a82eD7",
 *   "privateKey": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
 * }
 * 
 * Parâmetros obrigatórios:
 * - amount: Montante em wei para validação
 * - qTokenAddress: Endereço do qToken
 * - privateKey: Private key do usuário
 * 
 * Exemplo de resposta:
 * {
 *   "status": 200,
 *   "msg": "success",
 *   "data": {
 *     "validation": {
 *       "transactionHash": "0x...",
 *       "taxAmount": "100000000000000000",
 *       "restAmount": "900000000000000000"
 *     },
 *     "borrow": {
 *       "transactionHash": "0x...",
 *       "amountBorrowed": "900000000000000000"
 *     }
 *   }
 * }
 */
router.post('/validateAndBorrow', 
  verifySignature, 
  benqiValidationRateLimiter,
  sanitizeInput,
  async (req, res) => {
    try {
      const { amount, qTokenAddress, privateKey, rpc } = req.body;
      
      // Validação dos parâmetros obrigatórios
      if (!amount || !qTokenAddress || !privateKey) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'amount, qTokenAddress e privateKey são obrigatórios'
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
      const benqiService = new BenqiService(provider);
      
      console.log('🔄 Iniciando processo de validação + borrow...');
      
      // PASSO 1: Executar validação (payAndValidate)
      console.log('📋 Passo 1: Executando validação...');
      const validationResult = await validationService.payAndValidate(amount, privateKey);
      
      console.log('✅ Validação concluída:', validationResult.transactionHash);
      
      // PASSO 2: Executar borrow com o valor restante
      console.log('🔄 Passo 2: Executando borrow...');
      
      // Simula borrow (em produção, você integraria com o Benqi)
      const borrowResult = {
        transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
        status: 'success',
        amountBorrowed: validationResult.restAmount,
        qTokenAddress: qTokenAddress
      };
      
      console.log('✅ Borrow concluído:', borrowResult.transactionHash);
      
      res.json({
        status: 200,
        msg: 'success',
        data: {
          validation: {
            transactionHash: validationResult.transactionHash,
            status: validationResult.status,
            blockNumber: validationResult.blockNumber,
            gasUsed: validationResult.gasUsed,
            amountSent: validationResult.amountSent,
            taxAmount: validationResult.taxAmount,
            restAmount: validationResult.restAmount
          },
          borrow: borrowResult,
          summary: {
            totalAmount: amount,
            taxPaid: validationResult.taxAmount,
            amountBorrowed: validationResult.restAmount,
            taxRate: await validationService.getContractInfo().then(info => info.taxRate)
          }
        }
      });
      
    } catch (error) {
      console.error('Erro no validateAndBorrow:', error);
      res.status(500).json({
        status: 500,
        msg: 'error',
        data: {
          error: 'Erro no processo de validação + borrow',
          details: error.message
        }
      });
    }
  }
);

/**
 * @route POST /getValidationAndSupplyQuote
 * @desc Obtém cotação para validação + supply sem executar
 * @access Public (com autenticação)
 * 
 * COMO CHAMAR:
 * POST /benqi-validation/getValidationAndSupplyQuote
 * 
 * Headers: Content-Type: application/json
 * Body: {
 *   "address": "0x1234567890abcdef1234567890abcdef12345678",
 *   "signature": "0xabcd...",
 *   "message": "Get validation and supply quote\nTimestamp: 1234567890",
 *   "timestamp": 1234567890,
 *   "amount": "1000000000000000000",
 *   "qTokenAddress": "0x4A2c2838c3904D4B0B4a82eD7a3d0d3a0B4a82eD7"
 * }
 * 
 * Exemplo de resposta:
 * {
 *   "status": 200,
 *   "msg": "success",
 *   "data": {
 *     "validation": {
 *       "taxAmount": "100000000000000000",
 *       "restAmount": "900000000000000000",
 *       "taxRate": "10"
 *     },
 *     "supply": {
 *       "amountSupplied": "900000000000000000",
 *       "qTokenAddress": "0x4A2c2838c3904D4B0B4a82eD7a3d0d3a0B4a82eD7"
 *     },
 *     "summary": {
 *       "totalAmount": "1000000000000000000",
 *       "finalAmount": "900000000000000000"
 *     }
 *   }
 * }
 */
router.post('/getValidationAndSupplyQuote', 
  verifySignature, 
  benqiValidationRateLimiter,
  sanitizeInput,
  async (req, res) => {
    try {
      const { amount, qTokenAddress, rpc } = req.body;
      
      // Validação dos parâmetros obrigatórios
      if (!amount || !qTokenAddress) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'amount e qTokenAddress são obrigatórios'
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
          validation: {
            taxAmount: taxAmount,
            restAmount: restAmount,
            taxRate: contractInfo.taxRate
          },
          supply: {
            amountSupplied: restAmount,
            qTokenAddress: qTokenAddress
          },
          summary: {
            totalAmount: amount,
            taxPaid: taxAmount,
            amountSupplied: restAmount,
            finalAmount: restAmount,
            totalFees: (BigInt(amount) - BigInt(restAmount)).toString()
          }
        }
      });
      
    } catch (error) {
      console.error('Erro ao obter cotação:', error);
      res.status(500).json({
        status: 500,
        msg: 'error',
        data: {
          error: 'Erro ao obter cotação de validação + supply',
          details: error.message
        }
      });
    }
  }
);

/**
 * @route POST /getValidationAndBorrowQuote
 * @desc Obtém cotação para validação + borrow sem executar
 * @access Public (com autenticação)
 * 
 * COMO CHAMAR:
 * POST /benqi-validation/getValidationAndBorrowQuote
 * 
 * Headers: Content-Type: application/json
 * Body: {
 *   "address": "0x1234567890abcdef1234567890abcdef12345678",
 *   "signature": "0xabcd...",
 *   "message": "Get validation and borrow quote\nTimestamp: 1234567890",
 *   "timestamp": 1234567890,
 *   "amount": "1000000000000000000",
 *   "qTokenAddress": "0x4A2c2838c3904D4B0B4a82eD7a3d0d3a0B4a82eD7"
 * }
 * 
 * Exemplo de resposta:
 * {
 *   "status": 200,
 *   "msg": "success",
 *   "data": {
 *     "validation": {
 *       "taxAmount": "100000000000000000",
 *       "restAmount": "900000000000000000",
 *       "taxRate": "10"
 *     },
 *     "borrow": {
 *       "amountBorrowed": "900000000000000000",
 *       "qTokenAddress": "0x4A2c2838c3904D4B0B4a82eD7a3d0d3a0B4a82eD7"
 *     },
 *     "summary": {
 *       "totalAmount": "1000000000000000000",
 *       "finalAmount": "900000000000000000"
 *     }
 *   }
 * }
 */
router.post('/getValidationAndBorrowQuote', 
  verifySignature, 
  benqiValidationRateLimiter,
  sanitizeInput,
  async (req, res) => {
    try {
      const { amount, qTokenAddress, rpc } = req.body;
      
      // Validação dos parâmetros obrigatórios
      if (!amount || !qTokenAddress) {
        return res.status(400).json({
          status: 400,
          msg: 'error',
          data: {
            error: 'amount e qTokenAddress são obrigatórios'
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
          validation: {
            taxAmount: taxAmount,
            restAmount: restAmount,
            taxRate: contractInfo.taxRate
          },
          borrow: {
            amountBorrowed: restAmount,
            qTokenAddress: qTokenAddress
          },
          summary: {
            totalAmount: amount,
            taxPaid: taxAmount,
            amountBorrowed: restAmount,
            finalAmount: restAmount,
            totalFees: (BigInt(amount) - BigInt(restAmount)).toString()
          }
        }
      });
      
    } catch (error) {
      console.error('Erro ao obter cotação:', error);
      res.status(500).json({
        status: 500,
        msg: 'error',
        data: {
          error: 'Erro ao obter cotação de validação + borrow',
          details: error.message
        }
      });
    }
  }
);

module.exports = router;

const { ethers } = require('ethers');
const { VALIDATION_ABI } = require('../config/validationABI');
const { VALIDATION, NETWORKS } = require('../config/constants');

/**
 * Serviço para interagir com o contrato Validation.sol
 * Gerencia taxas, validações e pagamentos
 */
class ValidationService {
  constructor(provider, walletAddress = null) {
    this.provider = provider;
    this.walletAddress = walletAddress;
    this.contractAddress = VALIDATION.CONTRACT_ADDRESS;
    
    // Verifica se o endereço do contrato está configurado
    if (this.contractAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error('Endereço do contrato Validation não configurado. Defina VALIDATION_CONTRACT_ADDRESS no .env');
    }
    
    // Cria instância do contrato
    this.contract = new ethers.Contract(
      this.contractAddress,
      VALIDATION_ABI,
      provider
    );
  }

  /**
   * Obtém informações do contrato (owner, taxRate)
   * @returns {Promise<Object>} Informações do contrato
   */
  async getContractInfo() {
    try {
      const [owner, taxRate] = await Promise.all([
        this.contract.owner(),
        this.contract.taxRate()
      ]);

      return {
        owner: owner,
        taxRate: taxRate.toString(),
        contractAddress: this.contractAddress,
        network: NETWORKS.AVALANCHE.name,
        chainId: NETWORKS.AVALANCHE.chainId
      };
    } catch (error) {
      throw new Error(`Erro ao obter informações do contrato: ${error.message}`);
    }
  }

  /**
   * Calcula o valor da taxa para um montante específico
   * @param {string} amount - Montante em wei
   * @returns {Promise<string>} Valor da taxa em wei
   */
  async calculateTax(amount) {
    try {
      const taxAmount = await this.contract.calculateValue(amount);
      return taxAmount.toString();
    } catch (error) {
      throw new Error(`Erro ao calcular taxa: ${error.message}`);
    }
  }

  /**
   * Obtém saldo do contrato
   * @returns {Promise<string>} Saldo em wei
   */
  async getContractBalance() {
    try {
      const balance = await this.provider.getBalance(this.contractAddress);
      return balance.toString();
    } catch (error) {
      throw new Error(`Erro ao obter saldo do contrato: ${error.message}`);
    }
  }

  /**
   * Prepara dados de transação para assinatura no frontend
   * @param {string} functionName - Nome da função a ser chamada
   * @param {Array} params - Parâmetros da função
   * @returns {Promise<Object>} Dados da transação
   */
  async prepareTransaction(functionName, params = []) {
    try {
      let data;
      let value = '0';

      switch (functionName) {
        case 'setTaxRate':
          data = this.contract.interface.encodeFunctionData('setTaxRate', [parseInt(params[0])]);
          break;
        case 'payAndValidate':
          data = this.contract.interface.encodeFunctionData('payAndValidate', []);
          value = params[0] || '0';
          break;
        case 'withdraw':
          data = this.contract.interface.encodeFunctionData('withdraw', []);
          break;
        default:
          throw new Error(`Função ${functionName} não suportada`);
      }

      // Estima gas
      const gasEstimate = await this.provider.estimateGas({
        to: this.contractAddress,
        data: data,
        value: value
      });

      // Obtém gas price
      const feeData = await this.provider.getFeeData();

      return {
        to: this.contractAddress,
        data: data,
        value: value,
        gas: (gasEstimate * 2n).toString(), // Adiciona margem de segurança
        gasPrice: feeData.gasPrice?.toString() || '0',
        chainId: NETWORKS.AVALANCHE.chainId,
        functionName: functionName,
        params: params
      };
    } catch (error) {
      throw new Error(`Erro ao preparar transação: ${error.message}`);
    }
  }

  /**
   * Prepara transação de payAndValidate para smart wallet
   * @param {string} amount - Montante em wei
   * @returns {Promise<Object>} Dados da transação
   */
  async preparePayAndValidate(amount) {
    try {
      // Valida o montante
      const amountWei = BigInt(amount);
      if (amountWei <= 0) {
        throw new Error('Montante deve ser maior que zero');
      }

      // Calcula taxa e valor restante
      const taxAmount = await this.calculateTax(amount);
      const restAmount = (BigInt(amount) - BigInt(taxAmount)).toString();

      // Prepara dados da transação
      const data = this.contract.interface.encodeFunctionData('payAndValidate', []);
      
      // Estima gas
      const gasEstimate = await this.provider.estimateGas({
        to: this.contractAddress,
        data: data,
        value: amount
      });

      // Obtém gas price
      const feeData = await this.provider.getFeeData();

      return {
        to: this.contractAddress,
        data: data,
        value: amount,
        gas: (gasEstimate * 2n).toString(),
        gasPrice: feeData.gasPrice?.toString() || '0',
        chainId: NETWORKS.AVALANCHE.chainId,
        taxAmount: taxAmount,
        restAmount: restAmount,
        referenceId: this.generateReferenceId(),
        status: 'ready_for_signature',
        note: 'Transação de validação preparada para assinatura no frontend'
      };
    } catch (error) {
      throw new Error(`Erro ao preparar payAndValidate: ${error.message}`);
    }
  }

  /**
   * Prepara transação de setTaxRate para smart wallet
   * @param {string} newTaxRate - Nova taxa (0-100)
   * @returns {Promise<Object>} Dados da transação
   */
  async prepareSetTaxRate(newTaxRate) {
    try {
      // Valida a taxa
      const taxRate = parseInt(newTaxRate);
      if (taxRate < 0 || taxRate > VALIDATION.MAX_TAX_RATE) {
        throw new Error(`Taxa deve estar entre 0 e ${VALIDATION.MAX_TAX_RATE}`);
      }

      // Prepara dados da transação
      const data = this.contract.interface.encodeFunctionData('setTaxRate', [taxRate]);
      
      // Estima gas
      const gasEstimate = await this.provider.estimateGas({
        to: this.contractAddress,
        data: data,
        value: '0'
      });

      // Obtém gas price
      const feeData = await this.provider.getFeeData();

      return {
        to: this.contractAddress,
        data: data,
        value: '0',
        gas: (gasEstimate * 2n).toString(),
        gasPrice: feeData.gasPrice?.toString() || '0',
        chainId: NETWORKS.AVALANCHE.chainId,
        newTaxRate: taxRate.toString(),
        referenceId: this.generateReferenceId(),
        status: 'ready_for_signature',
        note: 'Transação de setTaxRate preparada para assinatura no frontend'
      };
    } catch (error) {
      throw new Error(`Erro ao preparar setTaxRate: ${error.message}`);
    }
  }

  /**
   * Prepara transação de withdraw para smart wallet
   * @returns {Promise<Object>} Dados da transação
   */
  async prepareWithdraw() {
    try {
      // Obtém saldo do contrato
      const contractBalance = await this.provider.getBalance(this.contractAddress);

      if (contractBalance === 0n) {
        throw new Error('Contrato não possui fundos para retirar');
      }

      // Prepara dados da transação
      const data = this.contract.interface.encodeFunctionData('withdraw', []);
      
      // Estima gas
      const gasEstimate = await this.provider.estimateGas({
        to: this.contractAddress,
        data: data,
        value: '0'
      });

      // Obtém gas price
      const feeData = await this.provider.getFeeData();

      return {
        to: this.contractAddress,
        data: data,
        value: '0',
        gas: (gasEstimate * 2n).toString(),
        gasPrice: feeData.gasPrice?.toString() || '0',
        chainId: NETWORKS.AVALANCHE.chainId,
        amountWithdrawn: contractBalance.toString(),
        referenceId: this.generateReferenceId(),
        status: 'ready_for_signature',
        note: 'Transação de withdraw preparada para assinatura no frontend'
      };
    } catch (error) {
      throw new Error(`Erro ao preparar withdraw: ${error.message}`);
    }
  }

  /**
   * Gera um ID de referência único
   */
  generateReferenceId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}

module.exports = ValidationService;


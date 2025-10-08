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
   * Define nova taxa (apenas owner)
   * @param {string} newTaxRate - Nova taxa (0-100)
   * @param {string} privateKey - Private key do owner
   * @returns {Promise<Object>} Resultado da transação
   */
  async setTaxRate(newTaxRate, privateKey) {
    try {
      // Valida a taxa
      const taxRate = parseInt(newTaxRate);
      if (taxRate < 0 || taxRate > VALIDATION.MAX_TAX_RATE) {
        throw new Error(`Taxa deve estar entre 0 e ${VALIDATION.MAX_TAX_RATE}`);
      }

      // Cria wallet com a private key
      const wallet = new ethers.Wallet(privateKey, this.provider);
      const contractWithSigner = this.contract.connect(wallet);

      // Estima gas
      const gasEstimate = await contractWithSigner.setTaxRate.estimateGas(taxRate);
      
      // Executa transação
      const tx = await contractWithSigner.setTaxRate(taxRate, {
        gasLimit: gasEstimate * 2n // Adiciona margem de segurança
      });

      return {
        transactionHash: tx.hash,
        status: 'pending',
        gasEstimate: gasEstimate.toString(),
        newTaxRate: taxRate.toString()
      };
    } catch (error) {
      throw new Error(`Erro ao definir taxa: ${error.message}`);
    }
  }

  /**
   * Executa pagamento e validação (função payable)
   * @param {string} amount - Montante em wei a ser enviado
   * @param {string} privateKey - Private key do usuário
   * @returns {Promise<Object>} Resultado da transação
   */
  async payAndValidate(amount, privateKey) {
    try {
      // Valida o montante
      const amountWei = BigInt(amount);
      if (amountWei <= 0) {
        throw new Error('Montante deve ser maior que zero');
      }

      // Cria wallet com a private key
      const wallet = new ethers.Wallet(privateKey, this.provider);
      const contractWithSigner = this.contract.connect(wallet);

      // Estima gas
      const gasEstimate = await contractWithSigner.payAndValidate.estimateGas({
        value: amountWei
      });

      // Executa transação
      const tx = await contractWithSigner.payAndValidate({
        value: amountWei,
        gasLimit: gasEstimate * 2n // Adiciona margem de segurança
      });

      // Aguarda confirmação
      const receipt = await tx.wait();

      // Calcula valores
      const taxAmount = await this.calculateTax(amount);
      const restAmount = (BigInt(amount) - BigInt(taxAmount)).toString();

      return {
        transactionHash: tx.hash,
        status: receipt.status === 1 ? 'success' : 'failed',
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        amountSent: amount,
        taxAmount: taxAmount,
        restAmount: restAmount,
        receipt: receipt
      };
    } catch (error) {
      throw new Error(`Erro ao executar pagamento: ${error.message}`);
    }
  }

  /**
   * Retira fundos do contrato (apenas owner)
   * @param {string} privateKey - Private key do owner
   * @returns {Promise<Object>} Resultado da transação
   */
  async withdraw(privateKey) {
    try {
      // Cria wallet com a private key
      const wallet = new ethers.Wallet(privateKey, this.provider);
      const contractWithSigner = this.contract.connect(wallet);

      // Obtém saldo do contrato
      const contractBalance = await this.provider.getBalance(this.contractAddress);

      if (contractBalance === 0n) {
        throw new Error('Contrato não possui fundos para retirar');
      }

      // Estima gas
      const gasEstimate = await contractWithSigner.withdraw.estimateGas();

      // Executa transação
      const tx = await contractWithSigner.withdraw({
        gasLimit: gasEstimate * 2n // Adiciona margem de segurança
      });

      // Aguarda confirmação
      const receipt = await tx.wait();

      return {
        transactionHash: tx.hash,
        status: receipt.status === 1 ? 'success' : 'failed',
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        amountWithdrawn: contractBalance.toString(),
        receipt: receipt
      };
    } catch (error) {
      throw new Error(`Erro ao retirar fundos: ${error.message}`);
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
}

module.exports = ValidationService;


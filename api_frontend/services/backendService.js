const axios = require('axios');

class BackendService {
  constructor() {
    this.baseURL = process.env.BACKEND_API_URL || 'http://localhost:3001';
    this.timeout = parseInt(process.env.BACKEND_TIMEOUT) || 30000;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Interceptor para logs
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🔗 [Backend] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ [Backend] Erro na requisição:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ [Backend] ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error(`❌ [Backend] ${error.response?.status || 'NETWORK'} ${error.config?.url}:`, error.message);
        return Promise.reject(error);
      }
    );
  }

  // Verificar se o backend está disponível
  async checkHealth() {
    try {
      const response = await this.client.get('/health');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Obter informações do backend
  async getInfo() {
    try {
      const response = await this.client.get('/info');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // ===========================================
  // ROTAS DE LENDING
  // ===========================================

  // Listar qTokens disponíveis
  async getQTokens() {
    try {
      const response = await this.client.get('/benqi/qtokens');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Preparar transação de supply
  async prepareSupply(authData, qTokenAddress, amount) {
    try {
      const response = await this.client.post('/benqi/supply', {
        ...authData,
        qTokenAddress,
        amount: amount.toString()
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Preparar transação de redeem
  async prepareRedeem(authData, qTokenAddress, amount, isUnderlying = true) {
    try {
      const response = await this.client.post('/benqi/redeem', {
        ...authData,
        qTokenAddress,
        amount: amount.toString(),
        isUnderlying
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Preparar transação de borrow
  async prepareBorrow(authData, qTokenAddress, amount) {
    try {
      const response = await this.client.post('/benqi/borrow', {
        ...authData,
        qTokenAddress,
        amount: amount.toString()
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Preparar transação de repay
  async prepareRepay(authData, qTokenAddress, amount) {
    try {
      const response = await this.client.post('/benqi/repay', {
        ...authData,
        qTokenAddress,
        amount: amount.toString()
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Preparar transação de enterMarkets
  async prepareEnterMarkets(authData, qTokenAddresses) {
    try {
      const response = await this.client.post('/benqi/enterMarkets', {
        ...authData,
        qTokenAddresses
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Preparar transação de exitMarket
  async prepareExitMarket(authData, qTokenAddress) {
    try {
      const response = await this.client.post('/benqi/exitMarket', {
        ...authData,
        qTokenAddress
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // ===========================================
  // ROTAS COM VALIDAÇÃO
  // ===========================================

  // Preparar transação de validação + supply
  async prepareValidationAndSupply(authData, qTokenAddress, amount) {
    try {
      const response = await this.client.post('/benqi-validation/prepareValidationAndSupply', {
        ...authData,
        qTokenAddress,
        amount: amount.toString()
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Preparar transação de validação + redeem
  async prepareValidationAndRedeem(authData, qTokenAddress, amount, isUnderlying = true) {
    try {
      const response = await this.client.post('/benqi-validation/prepareValidationAndRedeem', {
        ...authData,
        qTokenAddress,
        amount: amount.toString(),
        isUnderlying
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Preparar transação de validação + borrow
  async prepareValidationAndBorrow(authData, qTokenAddress, amount) {
    try {
      const response = await this.client.post('/benqi-validation/prepareValidationAndBorrow', {
        ...authData,
        qTokenAddress,
        amount: amount.toString()
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Preparar transação de validação + repay
  async prepareValidationAndRepay(authData, qTokenAddress, amount) {
    try {
      const response = await this.client.post('/benqi-validation/prepareValidationAndRepay', {
        ...authData,
        qTokenAddress,
        amount: amount.toString()
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // ===========================================
  // ROTAS DE SWAP
  // ===========================================

  // Obter preço de swap
  async getSwapPrice(tokenIn, tokenOut, amount) {
    try {
      const response = await this.client.get('/dex/getprice', {
        params: {
          tokenIn,
          tokenOut,
          amount: amount.toString()
        }
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Preparar transação de swap
  async prepareSwap(authData, tokenIn, tokenOut, amountIn, minAmountOut) {
    try {
      const response = await this.client.post('/dex/swap', {
        ...authData,
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        minAmountOut: minAmountOut.toString()
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // ===========================================
  // ROTAS DE VALIDAÇÃO
  // ===========================================

  // Obter informações do contrato de validação
  async getValidationInfo(authData) {
    try {
      const response = await this.client.get('/validation/info', {
        data: authData
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Calcular taxa de validação
  async calculateValidationTax(authData, amount) {
    try {
      const response = await this.client.post('/validation/calculate', {
        ...authData,
        amount: amount.toString()
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Executar pagamento e validação
  async payAndValidate(privateKey, amount) {
    try {
      const response = await this.client.post('/validation/payAndValidate', {
        privateKey,
        amount: amount.toString()
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // ===========================================
  // ROTAS DE VALIDAÇÃO + SWAP
  // ===========================================

  // Preparar transação de validação + swap
  async prepareValidationAndSwap(authData, tokenIn, tokenOut, amountIn, minAmountOut) {
    try {
      const response = await this.client.post('/validation-swap/prepareValidationAndSwap', {
        ...authData,
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        minAmountOut: minAmountOut.toString()
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Obter cotação de validação + swap
  async getValidationAndSwapQuote(authData, tokenIn, tokenOut, amountIn) {
    try {
      const response = await this.client.post('/validation-swap/getValidationAndSwapQuote', {
        ...authData,
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString()
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }
}

module.exports = BackendService;

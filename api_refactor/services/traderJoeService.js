const { ethers } = require('ethers');
const axios = require('axios');
const { TRADER_JOE, COMMON_TOKENS, API_URLS } = require('../config/constants');

// ABI completo para Trader Joe Router
const TRADER_JOE_ROUTER_ABI = [
  // Funções de consulta
  'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
  'function getAmountsIn(uint amountOut, address[] memory path) public view returns (uint[] memory amounts)',
  'function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) public pure returns (uint amountOut)',
  'function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) public pure returns (uint amountIn)',
  'function quote(uint amountA, uint reserveA, uint reserveB) public pure returns (uint amountB)',
  'function getReserves(address factory, address tokenA, address tokenB) public view returns (uint reserveA, uint reserveB)',
  
  // Funções de swap
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactAVAXForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapTokensForExactAVAX(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactTokensForAVAX(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapAVAXForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  
  // Funções de swap com suporte a fee on transfer
  'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
  'function swapExactAVAXForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
  'function swapExactTokensForAVAXSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
  
  // Funções de liquidez
  'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)',
  'function addLiquidityAVAX(address token, uint amountTokenDesired, uint amountTokenMin, uint amountAVAXMin, address to, uint deadline) external payable returns (uint amountToken, uint amountAVAX, uint liquidity)',
  'function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB)',
  'function removeLiquidityAVAX(address token, uint liquidity, uint amountTokenMin, uint amountAVAXMin, address to, uint deadline) external returns (uint amountToken, uint amountAVAX)',
  'function removeLiquidityWithPermit(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline, bool approveMax, uint8 v, bytes32 r, bytes32 s) external returns (uint amountA, uint amountB)',
  'function removeLiquidityAVAXWithPermit(address token, uint liquidity, uint amountTokenMin, uint amountAVAXMin, address to, uint deadline, bool approveMax, uint8 v, bytes32 r, bytes32 s) external returns (uint amountToken, uint amountAVAX)',
  
  // Funções de factory
  'function factory() external pure returns (address)',
  'function WAVAX() external pure returns (address)'
];

// ABI para ERC20
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)'
];

class TraderJoeService {
  constructor(provider, walletAddress = null, privateKey = null) {
    this.provider = provider;
    this.walletAddress = walletAddress;
    this.privateKey = privateKey;
    
    // Se private key for fornecida, cria uma wallet conectada
    if (privateKey) {
      this.wallet = new ethers.Wallet(privateKey, provider);
      this.walletAddress = this.wallet.address;
      // Para operações que precisam de wallet (escrita)
      this.routerWithWallet = new ethers.Contract(TRADER_JOE.ROUTER, TRADER_JOE_ROUTER_ABI, this.wallet);
    }
    
    // Para operações de leitura, não precisamos de wallet
    this.router = new ethers.Contract(TRADER_JOE.ROUTER, TRADER_JOE_ROUTER_ABI, provider);
  }

  /**
   * Obtém o preço de um token em relação a outro
   */
  async getPrice(tokenIn, tokenOut, amountIn = '1000000000000000000') { // 1 token por padrão
    try {
      const path = [tokenIn, tokenOut];
      const amounts = await this.router.getAmountsOut(amountIn, path);
      return {
        tokenIn,
        tokenOut,
        amountIn: amounts[0].toString(),
        amountOut: amounts[1].toString(),
        price: amounts[1].toString()
      };
    } catch (error) {
      throw new Error(`Erro ao obter preço: ${error.message}`);
    }
  }

  /**
   * Obtém preços de múltiplos pares
   */
  async getMultiplePrices(pairs) {
    try {
      const prices = {};
      for (const pair of pairs) {
        const { tokenIn, tokenOut, amountIn } = pair;
        const price = await this.getPrice(tokenIn, tokenOut, amountIn);
        prices[`${tokenIn}-${tokenOut}`] = price;
      }
      return prices;
    } catch (error) {
      throw new Error(`Erro ao obter múltiplos preços: ${error.message}`);
    }
  }

  /**
   * Calcula o slippage para uma transação
   */
  calculateSlippage(amountOut, slippagePercent) {
    const slippageMultiplier = slippagePercent / 100;
    const minAmountOut = amountOut * (1 - slippageMultiplier);
    return ethers.parseUnits(minAmountOut.toString(), 18);
  }


  /**
   * Obtém informações de liquidez de um par
   */
  async getLiquidityInfo(tokenA, tokenB) {
    try {
      const response = await axios.get(`${API_URLS.TRADER_JOE}/v1/pairs/${tokenA}/${tokenB}`);
      return response.data;
    } catch (error) {
      throw new Error(`Erro ao obter informações de liquidez: ${error.message}`);
    }
  }

  /**
   * Obtém histórico de preços de um token
   */
  async getPriceHistory(tokenAddress, days = 7) {
    try {
      const response = await axios.get(`${API_URLS.TRADER_JOE}/v1/tokens/${tokenAddress}/price-history?days=${days}`);
      return response.data;
    } catch (error) {
      throw new Error(`Erro ao obter histórico de preços: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de volume de um par
   */
  async getVolumeStats(tokenA, tokenB, period = '24h') {
    try {
      const response = await axios.get(`${API_URLS.TRADER_JOE}/v1/pairs/${tokenA}/${tokenB}/volume?period=${period}`);
      return response.data;
    } catch (error) {
      throw new Error(`Erro ao obter estatísticas de volume: ${error.message}`);
    }
  }

  /**
   * Verifica se um token tem suporte a fee on transfer
   */
  async supportsFeeOnTransfer(tokenAddress) {
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      // Tenta chamar a função que suporta fee on transfer
      await this.router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        ethers.parseUnits('1', 18),
        0,
        [tokenAddress, TRADER_JOE.WAVAX],
        this.walletAddress || '0x0000000000000000000000000000000000000000',
        Math.floor(Date.now() / 1000) + 1200
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtém informações de um token
   */
  async getTokenInfo(tokenAddress) {
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.totalSupply()
      ]);

      return {
        address: tokenAddress,
        name,
        symbol,
        decimals: decimals.toString(),
        totalSupply: totalSupply.toString(),
        formattedTotalSupply: ethers.formatUnits(totalSupply, decimals)
      };
    } catch (error) {
      throw new Error(`Erro ao obter informações do token: ${error.message}`);
    }
  }

  /**
   * Obtém o balance de um token para uma wallet
   */
  async getTokenBalance(tokenAddress, walletAddress) {
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const balance = await tokenContract.balanceOf(walletAddress);
      const decimals = await tokenContract.decimals();
      
      return {
        tokenAddress,
        walletAddress,
        balance: balance.toString(),
        formattedBalance: ethers.formatUnits(balance, decimals)
      };
    } catch (error) {
      throw new Error(`Erro ao obter balance do token: ${error.message}`);
    }
  }

  /**
   * Obtém liquidez do usuário para um par específico
   */
  async getUserLiquidity(tokenA, tokenB, address, id) {
    try {
      // Busca informações do par na API do Trader Joe
      const pairResponse = await axios.get(`${API_URLS.TRADER_JOE}/v1/pairs/${tokenA}/${tokenB}`);
      const pairData = pairResponse.data;
      
      // Busca posições de liquidez do usuário
      const userPositionsResponse = await axios.get(`${API_URLS.TRADER_JOE}/v1/positions/${address}?tokenA=${tokenA}&tokenB=${tokenB}`);
      const userPositions = userPositionsResponse.data;
      
      // Calcula liquidez total do usuário neste par
      let totalLiquidity = '0';
      let totalTokenA = '0';
      let totalTokenB = '0';
      
      if (userPositions && userPositions.length > 0) {
        for (const position of userPositions) {
          totalLiquidity = (BigInt(totalLiquidity) + BigInt(position.liquidity || '0')).toString();
          totalTokenA = (BigInt(totalTokenA) + BigInt(position.amountA || '0')).toString();
          totalTokenB = (BigInt(totalTokenB) + BigInt(position.amountB || '0')).toString();
        }
      }
      
      return {
        pairAddress: pairData.pairAddress || '0x0000000000000000000000000000000000000000',
        liquidity: totalLiquidity,
        tokenA: totalTokenA,
        tokenB: totalTokenB,
        pairInfo: {
          tokenA: pairData.tokenA,
          tokenB: pairData.tokenB,
          reserveA: pairData.reserveA || '0',
          reserveB: pairData.reserveB || '0',
          totalSupply: pairData.totalSupply || '0'
        }
      };
    } catch (error) {
      console.warn(`Aviso: Não foi possível obter liquidez do usuário via API: ${error.message}`);
      // Fallback para dados básicos
      return {
        pairAddress: '0x0000000000000000000000000000000000000000',
        liquidity: '0',
        tokenA: '0',
        tokenB: '0',
        note: 'Dados não disponíveis via API'
      };
    }
  }

  /**
   * Obtém liquidez total de um pool
   */
  async getPoolLiquidity(poolAddress, id) {
    try {
      // Busca informações do pool na API do Trader Joe
      const poolResponse = await axios.get(`${API_URLS.TRADER_JOE}/v1/pools/${poolAddress}`);
      const poolData = poolResponse.data;
      
      return {
        totalLiquidity: poolData.totalLiquidity || '0',
        reserveA: poolData.reserveA || '0',
        reserveB: poolData.reserveB || '0',
        totalSupply: poolData.totalSupply || '0',
        tokenA: poolData.tokenA,
        tokenB: poolData.tokenB,
        poolInfo: {
          address: poolAddress,
          id: id,
          volume24h: poolData.volume24h || '0',
          fees24h: poolData.fees24h || '0',
          apr: poolData.apr || '0'
        }
      };
    } catch (error) {
      console.warn(`Aviso: Não foi possível obter liquidez do pool via API: ${error.message}`);
      // Fallback para dados básicos
      return {
        totalLiquidity: '0',
        reserveA: '0',
        reserveB: '0',
        totalSupply: '0',
        note: 'Dados não disponíveis via API'
      };
    }
  }

  /**
   * Obtém liquidez individual dos tokens em um pool
   */
  async getTokenLiquidity(poolAddress) {
    try {
      // Busca informações do pool na API do Trader Joe
      const poolResponse = await axios.get(`${API_URLS.TRADER_JOE}/v1/pools/${poolAddress}`);
      const poolData = poolResponse.data;
      
      return {
        [poolData.tokenA]: poolData.reserveA || '0',
        [poolData.tokenB]: poolData.reserveB || '0',
        totalLiquidity: poolData.totalLiquidity || '0',
        poolInfo: {
          address: poolAddress,
          tokenA: poolData.tokenA,
          tokenB: poolData.tokenB,
          volume24h: poolData.volume24h || '0',
          fees24h: poolData.fees24h || '0',
          apr: poolData.apr || '0'
        }
      };
    } catch (error) {
      console.warn(`Aviso: Não foi possível obter liquidez dos tokens via API: ${error.message}`);
      // Fallback para dados básicos
      return {
        '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7': '0', // WAVAX
        '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB': '0', // USDC
        totalLiquidity: '0',
        note: 'Dados não disponíveis via API'
      };
    }
  }

  /**
   * Executa um swap seguindo a documentação da API
   */
  async executeSwap(params) {
    try {
      console.log('🔍 Debug executeSwap - params recebidos:', JSON.stringify(params, null, 2));
      
      const {
        path,
        amountIn,
        amountOutMin,
        to,
        from,
        gas,
        gasPriority,
        slippage,
        deadline,
        isAVAXSwap
      } = params;

      // Verifica se temos private key
      if (!this.wallet || !this.routerWithWallet) {
        throw new Error('Private key é obrigatória para executar swaps');
      }

      const tokenPath = path.split(',').map(addr => addr.trim());
      const swapDeadline = deadline || Math.floor(Date.now() / 1000) + 1200;
      
      // Converte os valores para BigInt para evitar overflow
      const amountInBigInt = BigInt(amountIn);
      const amountOutMinBigInt = BigInt(amountOutMin);
      
      console.log('🔄 Executando swap com private key...');
      console.log('📍 Path:', tokenPath);
      console.log('💰 Amount In (BigInt):', amountInBigInt.toString());
      console.log('🎯 Amount Out Min (BigInt):', amountOutMinBigInt.toString());
      console.log('⏰ Deadline:', swapDeadline);
      console.log('🪙 Is AVAX Swap:', isAVAXSwap);
      
      let tx;
      
      // Detectar se é swap de AVAX nativo
      const isAVAXNativeSwap = isAVAXSwap || 
        (tokenPath.length >= 2 && tokenPath[0].toLowerCase() === TRADER_JOE.WAVAX.toLowerCase());
      
      if (isAVAXNativeSwap) {
        console.log('🪙 Executando swap de AVAX nativo → tokens');
        
        // Para AVAX nativo, usamos swapExactAVAXForTokens
        // O path deve ser [WAVAX, tokenOut]
        const avaxPath = [TRADER_JOE.WAVAX, tokenPath[tokenPath.length - 1]];
        
        tx = await this.routerWithWallet.swapExactAVAXForTokens(
          amountOutMinBigInt,
          avaxPath,
          to || this.walletAddress,
          swapDeadline,
          {
            value: amountInBigInt, // O valor em AVAX é enviado como "value"
            gasLimit: gas || 500000,
            ...(gasPriority && { gasPrice: this.getGasPrice(gasPriority) })
          }
        );
      } else {
        console.log('🪙 Executando swap de tokens → tokens');
        
        // Para tokens normais, usamos swapExactTokensForTokens
        tx = await this.routerWithWallet.swapExactTokensForTokens(
          amountInBigInt,
          amountOutMinBigInt,
          tokenPath,
          to || this.walletAddress,
          swapDeadline,
          {
            gasLimit: gas || 500000,
            ...(gasPriority && { gasPrice: this.getGasPrice(gasPriority) })
          }
        );
      }
      
      console.log('✅ Swap executado com sucesso!');
      console.log('🔗 TX Hash:', tx.hash);
      
      return {
        chainId: '43114',
        from: this.walletAddress,
        to: TRADER_JOE.ROUTER,
        value: '0',
        gas: gas || '500000',
        txHash: tx.hash,
        referenceId: this.generateReferenceId(),
        status: 'pending',
        note: 'Transação executada e assinada automaticamente via private key',
        ...(gasPriority && { gasPrice: this.getGasPrice(gasPriority) })
      };
    } catch (error) {
      console.error('❌ Erro ao executar swap:', error.message);
      throw new Error(`Erro ao executar swap: ${error.message}`);
    }
  }

  /**
   * Adiciona liquidez seguindo a documentação da API
   */
  async addLiquidity(params) {
    try {
      const {
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
        strategy
      } = params;

      // Verifica se temos private key
      if (!this.wallet || !this.routerWithWallet) {
        throw new Error('Private key é obrigatória para adicionar liquidez');
      }

      const addLiquidityDeadline = deadline || Math.floor(Date.now() / 1000) + 1200;
      
      // Converte os valores para BigInt para evitar overflow
      const amountABigInt = BigInt(amountA);
      const amountBBigInt = BigInt(amountB);
      const amountAMinBigInt = BigInt(amountAMin);
      const amountBMinBigInt = BigInt(amountBMin);
      
      console.log('🔄 Adicionando liquidez com private key...');
      console.log('🪙 Token A:', tokenA);
      console.log('🪙 Token B:', tokenB);
      console.log('💰 Amount A (BigInt):', amountABigInt.toString());
      console.log('💰 Amount B (BigInt):', amountBBigInt.toString());
      console.log('⏰ Deadline:', addLiquidityDeadline);
      
      // Aguarda um pouco para evitar conflitos de nonce
      await this.waitForNextBlock();
      
      // Executa a adição de liquidez diretamente usando a private key
      const tx = await this.routerWithWallet.addLiquidity(
        tokenA,
        tokenB,
        amountABigInt,
        amountBBigInt,
        amountAMinBigInt,
        amountBMinBigInt,
        to || this.walletAddress,
        addLiquidityDeadline,
        {
          gasLimit: gas || 530000,
          ...(gasPriority && { gasPrice: this.getGasPrice(gasPriority) })
        }
      );
      
      console.log('✅ Liquidez adicionada com sucesso!');
      console.log('🔗 TX Hash:', tx.hash);
      
      // Retorna no formato da documentação
      return {
        chainId: '43114',
        from: this.walletAddress,
        to: TRADER_JOE.ROUTER,
        value: '0',
        gas: gas || '530000',
        txHash: tx.hash,
        referenceId: this.generateReferenceId(),
        status: 'pending',
        note: 'Transação executada e assinada automaticamente via private key',
        ...(gasPriority && { gasPrice: this.getGasPrice(gasPriority) })
      };
    } catch (error) {
      console.error('❌ Erro ao adicionar liquidez:', error.message);
      throw new Error(`Erro ao adicionar liquidez: ${error.message}`);
    }
  }

  /**
   * Remove liquidez seguindo a documentação da API
   */
  async removeLiquidity(params) {
    try {
      const {
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
        slippage
      } = params;

      // Verifica se temos private key
      if (!this.wallet || !this.routerWithWallet) {
        throw new Error('Private key é obrigatória para remover liquidez');
      }

      const removeLiquidityDeadline = deadline || Math.floor(Date.now() / 1000) + 1200;
      
      // Converte os valores para BigInt para evitar overflow
      const amountAMinBigInt = BigInt(amountAMin);
      const amountBMinBigInt = BigInt(amountBMin);
      
      console.log('🔄 Removendo liquidez com private key...');
      console.log('🪙 Token A:', tokenA);
      console.log('🪙 Token B:', tokenB);
      console.log('💰 Amount Min A (BigInt):', amountAMinBigInt.toString());
      console.log('💰 Amount Min B (BigInt):', amountBMinBigInt.toString());
      console.log('⏰ Deadline:', removeLiquidityDeadline);
      
      // Executa a remoção de liquidez diretamente usando a private key
      // A função removeLiquidity espera: (tokenA, tokenB, liquidity, amountAMin, amountBMin, to, deadline)
      const liquidityAmount = BigInt(amounts?.[0] || '1000000000000000'); // Default 0.001 LP tokens
      
      // Aguarda um pouco para evitar conflitos de nonce
      await this.waitForNextBlock();
      
      const tx = await this.routerWithWallet.removeLiquidity(
        tokenA,
        tokenB,
        liquidityAmount,
        amountAMinBigInt,
        amountBMinBigInt,
        to || this.walletAddress,
        removeLiquidityDeadline,
        {
          gasLimit: gas || 500000,
          ...(gasPriority && { gasPrice: this.getGasPrice(gasPriority) })
        }
      );
      
      console.log('✅ Liquidez removida com sucesso!');
      console.log('🔗 TX Hash:', tx.hash);
      
      // Retorna no formato da documentação
      return {
        chainId: '43114',
        from: this.walletAddress,
        to: TRADER_JOE.ROUTER,
        value: '0',
        gas: gas || '500000',
        txHash: tx.hash,
        referenceId: this.generateReferenceId(),
        status: 'pending',
        note: 'Transação executada e assinada automaticamente via private key',
        ...(gasPriority && { gasPrice: this.getGasPrice(gasPriority) })
      };
    } catch (error) {
      console.error('❌ Erro ao remover liquidez:', error.message);
      throw new Error(`Erro ao remover liquidez: ${error.message}`);
    }
  }

  /**
   * Gera um ID de referência único
   */
  generateReferenceId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Obtém o nonce atual da wallet
   */
  async getCurrentNonce() {
    try {
      const nonce = await this.wallet.getNonce('pending');
      console.log('🔢 Nonce atual (pending):', nonce);
      return nonce;
    } catch (error) {
      console.error('❌ Erro ao obter nonce:', error.message);
      throw error;
    }
  }

  /**
   * Aguarda um tempo para evitar conflitos de nonce
   */
  async waitForNextBlock() {
    return new Promise(resolve => setTimeout(resolve, 5000)); // 5 segundos
  }

  /**
   * Obtém preço do gas baseado na prioridade
   */
  getGasPrice(priority) {
    const gasPrices = {
      low: '25000000000',    // 25 gwei
      medium: '30000000000', // 30 gwei
      high: '37500000000'    // 37.5 gwei
    };
    return gasPrices[priority] || gasPrices.medium;
  }
}

module.exports = TraderJoeService;

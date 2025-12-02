const { ethers } = require('ethers');
const axios = require('axios');
const { BENQI, COMMON_TOKENS, API_URLS } = require('../config/constants');

// ABI para Benqi Comptroller
const BENQI_COMPTROLLER_ABI = [
  'function enterMarkets(address[] calldata qTokens) external returns (uint[] memory)',
  'function exitMarket(address qToken) external returns (uint)',
  'function getAccountLiquidity(address account) external view returns (uint, uint, uint)',
  'function getAssetsIn(address account) external view returns (address[] memory)',
  'function getHypotheticalAccountLiquidity(address account, address qTokenModify, uint redeemTokens, uint borrowAmount) external view returns (uint, uint, uint)',
  'function markets(address qToken) external view returns (bool, uint, bool)',
  'function oracle() external view returns (address)',
  'function closeFactorMantissa() external view returns (uint)',
  'function liquidationIncentiveMantissa() external view returns (uint)'
];

// ABI para Benqi qToken
const BENQI_QTOKEN_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function totalSupply() external view returns (uint)',
  'function balanceOf(address owner) external view returns (uint)',
  'function balanceOfUnderlying(address owner) external view returns (uint)',
  'function exchangeRateStored() external view returns (uint)',
  'function exchangeRateCurrent() external returns (uint)',
  'function supplyRatePerBlock() external view returns (uint)',
  'function borrowRatePerBlock() external view returns (uint)',
  'function totalBorrows() external view returns (uint)',
  'function totalReserves() external view returns (uint)',
  'function getCash() external view returns (uint)',
  'function accrueInterest() external returns (uint)',
  'function mint(uint mintAmount) external returns (uint)',
  'function redeem(uint redeemTokens) external returns (uint)',
  'function redeemUnderlying(uint redeemAmount) external returns (uint)',
  'function borrow(uint borrowAmount) external returns (uint)',
  'function repayBorrow(uint repayAmount) external returns (uint)',
  'function repayBorrowBehalf(address borrower, uint repayAmount) external returns (uint)',
  'function liquidateBorrow(address borrower, uint repayAmount, address qTokenCollateral) external returns (uint)',
  'function borrowBalanceCurrent(address account) external returns (uint)',
  'function borrowBalanceStored(address account) external view returns (uint)',
  'function totalBorrowBalanceCurrent(address account) external returns (uint)',
  'function totalBorrowBalanceStored(address account) external view returns (uint)',
  'function getAccountSnapshot(address account) external view returns (uint, uint, uint, uint)',
  'function borrowRatePerBlock() external view returns (uint)',
  'function supplyRatePerBlock() external view returns (uint)',
  'function totalSupply() external view returns (uint)',
  'function totalBorrows() external view returns (uint)',
  'function totalReserves() external view returns (uint)',
  'function getCash() external view returns (uint)',
  'function accrueInterest() external returns (uint)',
  'function mint(uint mintAmount) external returns (uint)',
  'function redeem(uint redeemTokens) external returns (uint)',
  'function redeemUnderlying(uint redeemAmount) external returns (uint)',
  'function borrow(uint borrowAmount) external returns (uint)',
  'function repayBorrow(uint repayAmount) external returns (uint)',
  'function repayBorrowBehalf(address borrower, uint repayAmount) external returns (uint)',
  'function liquidateBorrow(address borrower, uint repayAmount, address qTokenCollateral) external returns (uint)',
  'function borrowBalanceCurrent(address account) external returns (uint)',
  'function borrowBalanceStored(address account) external view returns (uint)',
  'function totalBorrowBalanceCurrent(address account) external returns (uint)',
  'function totalBorrowBalanceStored(address account) external view returns (uint)',
  'function getAccountSnapshot(address account) external view returns (uint, uint, uint, uint)'
];

// ABI para Benqi Price Oracle
const BENQI_ORACLE_ABI = [
  'function getUnderlyingPrice(address qToken) external view returns (uint)',
  'function getPrice(address asset) external view returns (uint)'
];

class BenqiService {
  constructor(provider, walletAddress = null) {
    this.provider = provider;
    this.walletAddress = walletAddress;
    
    // Contratos principais do Benqi
    this.comptroller = new ethers.Contract(BENQI.COMPTROLLER, BENQI_COMPTROLLER_ABI, provider);
    this.oracle = new ethers.Contract(BENQI.ORACLE, BENQI_ORACLE_ABI, provider);
  }

  /**
   * Obtém informações de um qToken
   */
  async getQTokenInfo(qTokenAddress) {
    try {
      const qToken = new ethers.Contract(qTokenAddress, BENQI_QTOKEN_ABI, this.provider);
      
      const [name, symbol, decimals, totalSupply, totalBorrows, totalReserves, getCash] = await Promise.all([
        qToken.name(),
        qToken.symbol(),
        qToken.decimals(),
        qToken.totalSupply(),
        qToken.totalBorrows(),
        qToken.totalReserves(),
        qToken.getCash()
      ]);

      return {
        address: qTokenAddress,
        name,
        symbol,
        decimals: decimals.toString(),
        totalSupply: totalSupply.toString(),
        totalBorrows: totalBorrows.toString(),
        totalReserves: totalReserves.toString(),
        totalCash: getCash.toString(),
        utilizationRate: totalBorrows > 0 ? (totalBorrows * 100n / totalSupply).toString() : '0'
      };
    } catch (error) {
      throw new Error(`Erro ao obter informações do qToken: ${error.message}`);
    }
  }

  /**
   * Obtém taxa de juros de um qToken
   */
  async getInterestRates(qTokenAddress) {
    try {
      const qToken = new ethers.Contract(qTokenAddress, BENQI_QTOKEN_ABI, this.provider);
      
      const [supplyRate, borrowRate] = await Promise.all([
        qToken.supplyRatePerBlock(),
        qToken.borrowRatePerBlock()
      ]);

      // Converte para taxa anual (aproximada)
      const blocksPerYear = 365 * 24 * 60 * 60 / 2; // 2 segundos por bloco
      const supplyRateAPY = (supplyRate * BigInt(blocksPerYear) / 1e18).toString();
      const borrowRateAPY = (borrowRate * BigInt(blocksPerYear) / 1e18).toString();

      return {
        qTokenAddress,
        supplyRatePerBlock: supplyRate.toString(),
        borrowRatePerBlock: borrowRate.toString(),
        supplyRateAPY: supplyRateAPY,
        borrowRateAPY: borrowRateAPY
      };
    } catch (error) {
      throw new Error(`Erro ao obter taxas de juros: ${error.message}`);
    }
  }

  /**
   * Obtém preço de um ativo
   */
  async getAssetPrice(assetAddress) {
    try {
      const price = await this.oracle.getUnderlyingPrice(assetAddress);
      return {
        assetAddress,
        price: price.toString(),
        priceFormatted: ethers.formatUnits(price, 18)
      };
    } catch (error) {
      throw new Error(`Erro ao obter preço do ativo: ${error.message}`);
    }
  }

  /**
   * Obtém liquidez da conta
   */
  async getAccountLiquidity(accountAddress) {
    try {
      const [liquidity, shortfall] = await this.comptroller.getAccountLiquidity(accountAddress);
      
      return {
        accountAddress,
        liquidity: liquidity.toString(),
        shortfall: shortfall.toString(),
        isHealthy: shortfall === 0n
      };
    } catch (error) {
      throw new Error(`Erro ao obter liquidez da conta: ${error.message}`);
    }
  }

  /**
   * Obtém ativos em uso pela conta
   */
  async getAssetsIn(accountAddress) {
    try {
      const assets = await this.comptroller.getAssetsIn(accountAddress);
      return {
        accountAddress,
        assets: assets,
        count: assets.length
      };
    } catch (error) {
      throw new Error(`Erro ao obter ativos da conta: ${error.message}`);
    }
  }

  /**
   * Obtém saldo de um qToken para uma conta
   */
  async getQTokenBalance(qTokenAddress, accountAddress) {
    try {
      const qToken = new ethers.Contract(qTokenAddress, BENQI_QTOKEN_ABI, this.provider);
      
      const [qTokenBalance, underlyingBalance] = await Promise.all([
        qToken.balanceOf(accountAddress),
        qToken.balanceOfUnderlying(accountAddress)
      ]);

      return {
        qTokenAddress,
        accountAddress,
        qTokenBalance: qTokenBalance.toString(),
        underlyingBalance: underlyingBalance.toString()
      };
    } catch (error) {
      throw new Error(`Erro ao obter saldo do qToken: ${error.message}`);
    }
  }

  /**
   * Obtém saldo de empréstimo de um qToken
   */
  async getBorrowBalance(qTokenAddress, accountAddress) {
    try {
      const qToken = new ethers.Contract(qTokenAddress, BENQI_QTOKEN_ABI, this.provider);
      
      const borrowBalance = await qToken.borrowBalanceCurrent(accountAddress);
      
      return {
        qTokenAddress,
        accountAddress,
        borrowBalance: borrowBalance.toString()
      };
    } catch (error) {
      throw new Error(`Erro ao obter saldo de empréstimo: ${error.message}`);
    }
  }

  /**
   * Prepara transação de supply (depósito)
   */
  async prepareSupply(qTokenAddress, amount) {
    try {
      const qToken = new ethers.Contract(qTokenAddress, BENQI_QTOKEN_ABI, this.provider);

      // Para qAVAX (AVAX nativo), enviar o amount como value
      // Para outros qTokens (ERC20), value é 0
      const isNativeAVAX = qTokenAddress.toLowerCase() === BENQI.QAVAX.toLowerCase();

      const transactionData = await qToken.mint.populateTransaction(
        isNativeAVAX ? amount : amount,
        {
          gasLimit: 300000,
          ...(isNativeAVAX && { value: amount })
        }
      );

      return {
        chainId: 43114,
        to: qTokenAddress,
        value: isNativeAVAX ? amount.toString() : '0',
        gas: '300000',
        data: transactionData.data,
        referenceId: this.generateReferenceId(),
        status: 'ready_for_signature',
        note: `Transação de supply preparada para assinatura no frontend${isNativeAVAX ? ' (AVAX nativo)' : ''}`
      };
    } catch (error) {
      throw new Error(`Erro ao preparar supply: ${error.message}`);
    }
  }

  /**
   * Prepara transação de redeem (saque)
   */
  async prepareRedeem(qTokenAddress, amount, isUnderlying = false) {
    try {
      const qToken = new ethers.Contract(qTokenAddress, BENQI_QTOKEN_ABI, this.provider);
      
      let transactionData;
      if (isUnderlying) {
        transactionData = await qToken.redeemUnderlying.populateTransaction(amount, {
          gasLimit: 300000
        });
      } else {
        transactionData = await qToken.redeem.populateTransaction(amount, {
          gasLimit: 300000
        });
      }

      return {
        chainId: 43114,
        to: qTokenAddress,
        value: '0',
        gas: '300000',
        data: transactionData.data,
        referenceId: this.generateReferenceId(),
        status: 'ready_for_signature',
        note: 'Transação de redeem preparada para assinatura no frontend'
      };
    } catch (error) {
      throw new Error(`Erro ao preparar redeem: ${error.message}`);
    }
  }

  /**
   * Prepara transação de borrow (empréstimo)
   */
  async prepareBorrow(qTokenAddress, amount) {
    try {
      const qToken = new ethers.Contract(qTokenAddress, BENQI_QTOKEN_ABI, this.provider);
      
      const transactionData = await qToken.borrow.populateTransaction(amount, {
        gasLimit: 300000
      });

      return {
        chainId: 43114,
        to: qTokenAddress,
        value: '0',
        gas: '300000',
        data: transactionData.data,
        referenceId: this.generateReferenceId(),
        status: 'ready_for_signature',
        note: 'Transação de borrow preparada para assinatura no frontend'
      };
    } catch (error) {
      throw new Error(`Erro ao preparar borrow: ${error.message}`);
    }
  }

  /**
   * Prepara transação de repay (pagamento de empréstimo)
   */
  async prepareRepay(qTokenAddress, amount) {
    try {
      const qToken = new ethers.Contract(qTokenAddress, BENQI_QTOKEN_ABI, this.provider);
      
      const transactionData = await qToken.repayBorrow.populateTransaction(amount, {
        gasLimit: 300000
      });

      return {
        chainId: 43114,
        to: qTokenAddress,
        value: '0',
        gas: '300000',
        data: transactionData.data,
        referenceId: this.generateReferenceId(),
        status: 'ready_for_signature',
        note: 'Transação de repay preparada para assinatura no frontend'
      };
    } catch (error) {
      throw new Error(`Erro ao preparar repay: ${error.message}`);
    }
  }

  /**
   * Prepara transação de enterMarkets
   */
  async prepareEnterMarkets(qTokenAddresses) {
    try {
      const transactionData = await this.comptroller.enterMarkets.populateTransaction(qTokenAddresses, {
        gasLimit: 500000
      });

      return {
        chainId: 43114,
        to: BENQI.COMPTROLLER,
        value: '0',
        gas: '500000',
        data: transactionData.data,
        referenceId: this.generateReferenceId(),
        status: 'ready_for_signature',
        note: 'Transação de enterMarkets preparada para assinatura no frontend'
      };
    } catch (error) {
      throw new Error(`Erro ao preparar enterMarkets: ${error.message}`);
    }
  }

  /**
   * Prepara transação de exitMarket
   */
  async prepareExitMarket(qTokenAddress) {
    try {
      const transactionData = await this.comptroller.exitMarket.populateTransaction(qTokenAddress, {
        gasLimit: 300000
      });

      return {
        chainId: 43114,
        to: BENQI.COMPTROLLER,
        value: '0',
        gas: '300000',
        data: transactionData.data,
        referenceId: this.generateReferenceId(),
        status: 'ready_for_signature',
        note: 'Transação de exitMarket preparada para assinatura no frontend'
      };
    } catch (error) {
      throw new Error(`Erro ao preparar exitMarket: ${error.message}`);
    }
  }

  /**
   * Obtém informações completas da conta
   */
  async getAccountInfo(accountAddress) {
    try {
      const [liquidity, assetsIn, qTokenBalances, borrowBalances] = await Promise.all([
        this.getAccountLiquidity(accountAddress),
        this.getAssetsIn(accountAddress),
        this.getQTokenBalances(accountAddress),
        this.getBorrowBalances(accountAddress)
      ]);

      return {
        accountAddress,
        liquidity,
        assetsIn,
        qTokenBalances,
        borrowBalances,
        summary: {
          totalSupplied: qTokenBalances.reduce((sum, balance) => sum + BigInt(balance.underlyingBalance), 0n).toString(),
          totalBorrowed: borrowBalances.reduce((sum, balance) => sum + BigInt(balance.borrowBalance), 0n).toString(),
          healthFactor: liquidity.isHealthy ? 'healthy' : 'unhealthy'
        }
      };
    } catch (error) {
      throw new Error(`Erro ao obter informações da conta: ${error.message}`);
    }
  }

  /**
   * Obtém saldos de todos os qTokens da conta
   */
  async getQTokenBalances(accountAddress) {
    try {
      const assetsIn = await this.getAssetsIn(accountAddress);
      const balances = [];

      for (const qTokenAddress of assetsIn.assets) {
        const balance = await this.getQTokenBalance(qTokenAddress, accountAddress);
        balances.push(balance);
      }

      return balances;
    } catch (error) {
      throw new Error(`Erro ao obter saldos dos qTokens: ${error.message}`);
    }
  }

  /**
   * Obtém saldos de empréstimo de todos os qTokens da conta
   */
  async getBorrowBalances(accountAddress) {
    try {
      const assetsIn = await this.getAssetsIn(accountAddress);
      const balances = [];

      for (const qTokenAddress of assetsIn.assets) {
        const balance = await this.getBorrowBalance(qTokenAddress, accountAddress);
        if (BigInt(balance.borrowBalance) > 0n) {
          balances.push(balance);
        }
      }

      return balances;
    } catch (error) {
      throw new Error(`Erro ao obter saldos de empréstimo: ${error.message}`);
    }
  }

  /**
   * Gera um ID de referência único
   */
  generateReferenceId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}

module.exports = BenqiService;

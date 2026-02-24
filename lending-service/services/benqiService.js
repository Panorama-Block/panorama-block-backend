const { ethers } = require('ethers');
const axios = require('axios');
const { BENQI, COMMON_TOKENS, API_URLS } = require('../config/constants');

// ABI para Benqi Comptroller
const BENQI_COMPTROLLER_ABI = [
  'function enterMarkets(address[] calldata qTokens) external returns (uint[] memory)',
  'function exitMarket(address qToken) external returns (uint)',
  'function getAllMarkets() external view returns (address[] memory)',
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
  'function comptroller() external view returns (address)',
  // For ERC20-based markets (qAVAX does not implement this)
  'function underlying() external view returns (address)',
  'function totalSupply() external view returns (uint)',
  'function balanceOf(address owner) external view returns (uint)',
  'function balanceOfUnderlying(address owner) external view returns (uint)',
  'function exchangeRateStored() external view returns (uint)',
  'function exchangeRateCurrent() external returns (uint)',
  // Some Compound forks expose per-timestamp rates instead of per-block.
  'function supplyRatePerBlock() external view returns (uint)',
  'function borrowRatePerBlock() external view returns (uint)',
  'function supplyRatePerTimestamp() external view returns (uint)',
  'function borrowRatePerTimestamp() external view returns (uint)',
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
    // Resolve oracle dynamically via comptroller.oracle() when possible; keep BENQI.ORACLE as a fallback.
    this._resolvedOracle = null;
    this._resolvedOracleAddress = null;

    // Comptroller/Unitroller discovery:
    // Some constants may drift or be misconfigured; resolve the real comptroller by:
    // 1) Trying configured candidates (UNITROLLER, COMPTROLLER)
    // 2) Deriving comptroller() from a known qToken and validating getAllMarkets()
    const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
    this.comptrollerCandidates = uniq([BENQI.UNITROLLER, BENQI.COMPTROLLER]).filter((a) => ethers.isAddress(a));
    this._resolvedComptroller = null;
    this._resolvedComptrollerAddress = null;
  }

  /**
   * Resolve and cache the Price Oracle contract to use.
   */
  async getOracle() {
    if (this._resolvedOracle) return this._resolvedOracle;

    let oracleAddress = null;
    try {
      const comptroller = await this.getComptroller();
      oracleAddress = await comptroller.oracle();
    } catch {
      // ignore and fallback
    }

    if (!oracleAddress || !ethers.isAddress(oracleAddress)) {
      oracleAddress = BENQI.ORACLE;
    }
    if (!ethers.isAddress(oracleAddress)) {
      throw new Error('Oracle address not configured (BENQI_ORACLE missing and comptroller.oracle() unavailable).');
    }

    this._resolvedOracleAddress = oracleAddress;
    this._resolvedOracle = new ethers.Contract(oracleAddress, BENQI_ORACLE_ABI, this.provider);
    return this._resolvedOracle;
  }

  /**
   * Resolve and cache the Comptroller contract to use.
   */
  async getComptroller() {
    if (this._resolvedComptroller) return this._resolvedComptroller;
    const resolved = await this.resolveComptrollerAddress();
    this._resolvedComptrollerAddress = resolved;
    this._resolvedComptroller = new ethers.Contract(resolved, BENQI_COMPTROLLER_ABI, this.provider);
    return this._resolvedComptroller;
  }

  async resolveComptrollerAddress() {
    const testCandidate = async (address) => {
      if (!ethers.isAddress(address)) return null;
      try {
        const c = new ethers.Contract(address, BENQI_COMPTROLLER_ABI, this.provider);
        const markets = await c.getAllMarkets();
        if (!Array.isArray(markets) || markets.length === 0) return null;
        const first = markets.find((m) => ethers.isAddress(m));
        if (!first) return null;
        // Stronger sanity check: the market should be a qToken and point back to this comptroller.
        const t = new ethers.Contract(
          first,
          [
            'function symbol() external view returns (string)',
            'function comptroller() external view returns (address)',
          ],
          this.provider
        );
        const [sym, backref] = await Promise.all([t.symbol(), t.comptroller()]);
        if (typeof sym !== 'string' || sym.length === 0) return null;
        if (!ethers.isAddress(backref)) return null;
        if (backref.toLowerCase() !== address.toLowerCase()) return null;
        return address;
      } catch {
        return null;
      }
    };

    for (const candidate of this.comptrollerCandidates) {
      const ok = await testCandidate(candidate);
      if (ok) return ok;
    }

    // Derive from known qTokens (if configured) to self-heal misconfigured comptroller constants.
    const qTokenSeeds = [
      BENQI.QUSDC,
      BENQI.QUSDT,
      BENQI.QDAI,
      BENQI.QWETH,
      BENQI.QLINK,
      BENQI.QJOE,
      BENQI.QQI,
      BENQI.QCOQ,
      BENQI.QAVAX,
    ].filter((a) => ethers.isAddress(a));

    for (const seed of qTokenSeeds) {
      try {
        const q = new ethers.Contract(seed, BENQI_QTOKEN_ABI, this.provider);
        const maybe = await q.comptroller();
        const ok = await testCandidate(maybe);
        if (ok) return ok;
      } catch {
        // ignore seed failures
      }
    }

    throw new Error('Não foi possível resolver o Comptroller do Benqi (getAllMarkets indisponível). Verifique as constantes BENQI_*.');
  }

  /**
   * List all qToken market addresses from the comptroller.
   */
  async getAllMarkets() {
    try {
      const comptroller = await this.getComptroller();
      const markets = await comptroller.getAllMarkets();
      return Array.isArray(markets) ? markets : [];
    } catch (error) {
      throw new Error(`Erro ao obter mercados: ${error.message}`);
    }
  }

  /**
   * Returns the underlying token address for a qToken.
   * Note: qAVAX (native market) does not implement underlying().
   */
  async getUnderlyingAddress(qTokenAddress) {
    try {
      const qToken = new ethers.Contract(qTokenAddress, BENQI_QTOKEN_ABI, this.provider);
      const underlying = await qToken.underlying();
      return underlying;
    } catch (error) {
      return null;
    }
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
      
      let supplyRate;
      let borrowRate;
      let rateUnit = 'block';

      try {
        [supplyRate, borrowRate] = await Promise.all([
          qToken.supplyRatePerBlock(),
          qToken.borrowRatePerBlock(),
        ]);
      } catch {
        rateUnit = 'timestamp';
        [supplyRate, borrowRate] = await Promise.all([
          qToken.supplyRatePerTimestamp(),
          qToken.borrowRatePerTimestamp(),
        ]);
      }

      // Approximate APY from per-period rate (linear approximation).
      // NOTE: Use float math to preserve decimals; BigInt integer division would truncate to 0 for small rates.
      const secondsPerYear = 365 * 24 * 60 * 60;
      const blocksPerYear = secondsPerYear / 2; // ~2s per block on Avalanche (best-effort)
      const periodsPerYear = rateUnit === 'timestamp' ? secondsPerYear : blocksPerYear;

      const supplyRatePerPeriod = parseFloat(ethers.formatUnits(supplyRate, 18));
      const borrowRatePerPeriod = parseFloat(ethers.formatUnits(borrowRate, 18));

      const supplyApy = Number.isFinite(supplyRatePerPeriod) ? supplyRatePerPeriod * periodsPerYear : 0;
      const borrowApy = Number.isFinite(borrowRatePerPeriod) ? borrowRatePerPeriod * periodsPerYear : 0;

      const supplyApyPercent = supplyApy * 100;
      const borrowApyPercent = borrowApy * 100;

      const supplyApyBps = Math.round(supplyApyPercent * 100);
      const borrowApyBps = Math.round(borrowApyPercent * 100);

      return {
        qTokenAddress,
        rateUnit,
        periodsPerYear,
        supplyRatePerPeriod: supplyRate.toString(),
        borrowRatePerPeriod: borrowRate.toString(),
        // Back-compat keys (kept for older clients)
        supplyRatePerBlock: rateUnit === 'block' ? supplyRate.toString() : null,
        borrowRatePerBlock: rateUnit === 'block' ? borrowRate.toString() : null,
        supplyRatePerTimestamp: rateUnit === 'timestamp' ? supplyRate.toString() : null,
        borrowRatePerTimestamp: rateUnit === 'timestamp' ? borrowRate.toString() : null,
        // Back-compat (human % as string)
        supplyRateAPY: supplyApyPercent.toString(),
        borrowRateAPY: borrowApyPercent.toString(),
        // Preferred (integer, basis points)
        supplyApyBps,
        borrowApyBps,
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
      const oracle = await this.getOracle();
      const price = await oracle.getUnderlyingPrice(assetAddress);
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
      // Compound-style: (errorCode, liquidity, shortfall)
      const comptroller = await this.getComptroller();
      const [errorCode, liquidity, shortfall] = await comptroller.getAccountLiquidity(accountAddress);
      
      return {
        accountAddress,
        errorCode: errorCode.toString(),
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
      const comptroller = await this.getComptroller();
      const assetsRaw = await comptroller.getAssetsIn(accountAddress);
      const assets = (Array.isArray(assetsRaw) ? assetsRaw : []).filter(
        (asset) => typeof asset === 'string' && ethers.isAddress(asset)
      );
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

      // borrowBalanceCurrent is non-view in Compound-style markets.
      // With a provider-only contract (no signer), calling it directly can try to send a tx in ethers v6.
      // Prefer staticCall, and fall back to borrowBalanceStored for read-only flows.
      let borrowBalance;
      try {
        if (qToken.borrowBalanceCurrent?.staticCall) {
          borrowBalance = await qToken.borrowBalanceCurrent.staticCall(accountAddress);
        } else {
          borrowBalance = await qToken.borrowBalanceStored(accountAddress);
        }
      } catch (_) {
        borrowBalance = await qToken.borrowBalanceStored(accountAddress);
      }
      
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
      const underlying = await this.getUnderlyingAddress(qTokenAddress);
      const isNativeAVAX = !underlying;

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
  async prepareRedeem(qTokenAddress, amount, isUnderlying = true) {
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
        note: `Transação de ${isUnderlying ? 'redeemUnderlying' : 'redeem'} preparada para assinatura no frontend`
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
      const comptroller = await this.getComptroller();
      const transactionData = await comptroller.enterMarkets.populateTransaction(qTokenAddresses, {
        gasLimit: 500000
      });

      return {
        chainId: 43114,
        to: this._resolvedComptrollerAddress || BENQI.UNITROLLER || BENQI.COMPTROLLER,
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
      const comptroller = await this.getComptroller();
      const transactionData = await comptroller.exitMarket.populateTransaction(qTokenAddress, {
        gasLimit: 300000
      });

      return {
        chainId: 43114,
        to: this._resolvedComptrollerAddress || BENQI.UNITROLLER || BENQI.COMPTROLLER,
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

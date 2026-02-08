import { ethers } from 'ethers';
import axios from 'axios';
import { ILidoRepository } from '../../domain/interfaces/ILidoRepository';
import { LidoProtocolInfo, StakingPosition, StakingTransaction, WithdrawalRequest } from '../../domain/entities/StakingPosition';
import { PortfolioAsset, PortfolioMetricDaily } from '../../domain/entities/Portfolio';
import { EthereumConfig } from '../config/ethereum';
import { LIDO_CONTRACTS, STETH_ABI, WSTETH_ABI, WITHDRAWAL_QUEUE_ABI } from '../config/lidoContracts';
import { DatabaseService } from '../database/database.service';
import { Logger } from '../logs/logger';

export class LidoRepository implements ILidoRepository {
  private ethereumConfig: EthereumConfig;
  private logger: Logger;
  private stETHContract!: ethers.Contract;
  private wstETHContract!: ethers.Contract;
  private withdrawalQueueContract!: ethers.Contract;
  private db: DatabaseService | null;

  constructor() {
    this.ethereumConfig = EthereumConfig.getInstance();
    this.logger = new Logger();
    this.db = DatabaseService.isConfigured() ? DatabaseService.getInstance() : null;
    this.initializeContracts();
  }

  private async upsertUser(userAddress: string): Promise<void> {
    if (!this.db) return;
    const normalizedAddress = ethers.utils.getAddress(userAddress);
    await this.db.query(
      `
        INSERT INTO lido_users (address)
        VALUES ($1)
        ON CONFLICT (address) DO UPDATE SET updated_at = NOW()
      `,
      [normalizedAddress]
    );
  }

  private async persistTransaction(options: {
    tx: StakingTransaction;
    chainId: number;
    amountWei: ethers.BigNumber;
  }): Promise<void> {
    if (!this.db) return;
    const { tx, chainId, amountWei } = options;
    const normalizedAddress = ethers.utils.getAddress(tx.userAddress);
    await this.upsertUser(normalizedAddress);

    await this.db.query(
      `
        INSERT INTO lido_transactions
          (id, address, chain_id, type, token, amount_wei, amount_input, status, tx_hash, tx_data)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          tx_hash = COALESCE(EXCLUDED.tx_hash, lido_transactions.tx_hash),
          tx_data = COALESCE(EXCLUDED.tx_data, lido_transactions.tx_data),
          updated_at = NOW()
      `,
      [
        tx.id,
        normalizedAddress,
        chainId,
        tx.type,
        tx.token,
        amountWei.toString(),
        tx.amount,
        tx.status,
        tx.transactionHash || null,
        tx.transactionData ? JSON.stringify(tx.transactionData) : null,
      ]
    );
  }

  private async persistPosition(options: {
    userAddress: string;
    chainId: number;
    stETHBalanceWei: ethers.BigNumber;
    wstETHBalanceWei: ethers.BigNumber;
    totalStakedWei: ethers.BigNumber;
    apyBps: number | null;
    blockNumber?: number | null;
  }): Promise<void> {
    if (!this.db) return;
    const {
      userAddress,
      chainId,
      stETHBalanceWei,
      wstETHBalanceWei,
      totalStakedWei,
      apyBps,
      blockNumber,
    } = options;

    const normalizedAddress = ethers.utils.getAddress(userAddress);
    await this.upsertUser(normalizedAddress);

    await this.db.transaction(async (client) => {
      await client.query(
        `
          INSERT INTO lido_positions_current
            (address, chain_id, steth_balance_wei, wsteth_balance_wei, total_staked_wei, apy_bps, block_number, updated_at)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (address) DO UPDATE SET
            chain_id = EXCLUDED.chain_id,
            steth_balance_wei = EXCLUDED.steth_balance_wei,
            wsteth_balance_wei = EXCLUDED.wsteth_balance_wei,
            total_staked_wei = EXCLUDED.total_staked_wei,
            apy_bps = EXCLUDED.apy_bps,
            block_number = EXCLUDED.block_number,
            updated_at = NOW()
        `,
        [
          normalizedAddress,
          chainId,
          stETHBalanceWei.toString(),
          wstETHBalanceWei.toString(),
          totalStakedWei.toString(),
          apyBps,
          blockNumber ?? null,
        ]
      );

      // Snapshot: insert a record each time position is fetched.
      await client.query(
        `
          INSERT INTO lido_position_snapshots
            (address, chain_id, steth_balance_wei, wsteth_balance_wei, total_staked_wei, apy_bps, block_number)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          normalizedAddress,
          chainId,
          stETHBalanceWei.toString(),
          wstETHBalanceWei.toString(),
          totalStakedWei.toString(),
          apyBps,
          blockNumber ?? null,
        ]
      );

      // Portfolio assets (current balances per token)
      await client.query(
        `
          INSERT INTO lido_portfolio_assets
            (address, chain_id, token_symbol, token_address, balance_wei, updated_at)
          VALUES
            ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (address, chain_id, token_address) DO UPDATE SET
            token_symbol = EXCLUDED.token_symbol,
            balance_wei = EXCLUDED.balance_wei,
            updated_at = NOW()
        `,
        [normalizedAddress, chainId, 'stETH', LIDO_CONTRACTS.STETH, stETHBalanceWei.toString()]
      );

      await client.query(
        `
          INSERT INTO lido_portfolio_assets
            (address, chain_id, token_symbol, token_address, balance_wei, updated_at)
          VALUES
            ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (address, chain_id, token_address) DO UPDATE SET
            token_symbol = EXCLUDED.token_symbol,
            balance_wei = EXCLUDED.balance_wei,
            updated_at = NOW()
        `,
        [normalizedAddress, chainId, 'wstETH', LIDO_CONTRACTS.WSTETH, wstETHBalanceWei.toString()]
      );

      // Portfolio daily metrics (stored once per day)
      await client.query(
        `
          INSERT INTO lido_portfolio_metrics_daily
            (address, chain_id, date, steth_balance_wei, wsteth_balance_wei, total_staked_wei, apy_bps, updated_at)
          VALUES
            ($1, $2, CURRENT_DATE, $3, $4, $5, $6, NOW())
          ON CONFLICT (address, chain_id, date) DO UPDATE SET
            steth_balance_wei = EXCLUDED.steth_balance_wei,
            wsteth_balance_wei = EXCLUDED.wsteth_balance_wei,
            total_staked_wei = EXCLUDED.total_staked_wei,
            apy_bps = EXCLUDED.apy_bps,
            updated_at = NOW()
        `,
        [
          normalizedAddress,
          chainId,
          stETHBalanceWei.toString(),
          wstETHBalanceWei.toString(),
          totalStakedWei.toString(),
          apyBps,
        ]
      );
    });
  }

  private initializeContracts(): void {
    try {
      const provider = this.ethereumConfig.getProvider();
      
      this.stETHContract = new ethers.Contract(
        LIDO_CONTRACTS.STETH,
        STETH_ABI,
        provider
      );

      this.wstETHContract = new ethers.Contract(
        LIDO_CONTRACTS.WSTETH,
        WSTETH_ABI,
        provider
      );

      this.withdrawalQueueContract = new ethers.Contract(
        LIDO_CONTRACTS.WITHDRAWAL_QUEUE,
        WITHDRAWAL_QUEUE_ABI,
        provider
      );

      this.logger.info('Lido contracts initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Lido contracts: ${error}`);
      throw error;
    }
  }

  async stake(userAddress: string, amount: string): Promise<StakingTransaction> {
    try {
      this.logger.info(`Creating stake transaction for ${userAddress} with amount ${amount}`);
      
      const transactionId = this.generateTransactionId();
      const amountWei = ethers.utils.parseEther(amount);
      
      this.logger.info('Preparing stake transaction for client-side signing');

      const stETHContract = new ethers.Contract(
        LIDO_CONTRACTS.STETH,
        STETH_ABI,
        this.ethereumConfig.getProvider()
      );

      // _referral address is set to zero address (no referral)
      const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
      const txData = await stETHContract.populateTransaction.submit(ZERO_ADDRESS, {
        value: amountWei
      });

      const transaction: StakingTransaction = {
        id: transactionId,
        userAddress,
        type: 'stake',
        amount,
        token: 'ETH',
        status: 'pending',
        transactionData: {
          to: txData.to || LIDO_CONTRACTS.STETH,
          data: txData.data || '0x',
          value: txData.value?.toString() || '0',
          gasLimit: '200000',
          chainId: this.ethereumConfig.getChainId()
        },
        timestamp: new Date()
      };
      
      this.logger.info(`Stake transaction prepared for signing: ${transactionId}`);

      try {
        await this.persistTransaction({
          tx: transaction,
          chainId: this.ethereumConfig.getChainId(),
          amountWei,
        });
      } catch (e) {
        this.logger.warn(`Failed to persist stake transaction: ${e}`);
      }

      return transaction;
    } catch (error) {
      this.logger.error(`Error creating stake transaction: ${error}`);
      throw error;
    }
  }

  async unstake(userAddress: string, amount: string): Promise<StakingTransaction> {
    try {
      this.logger.info(`Creating unstake transaction for ${userAddress} with amount ${amount}`);

      const transactionId = this.generateTransactionId();
      const amountWei = ethers.utils.parseEther(amount);

      // Normalize address
      const normalizedAddress = ethers.utils.getAddress(userAddress);

      let transaction: StakingTransaction;

      this.logger.info('Preparing unstake transaction for client-side signing');

      // Check current stETH allowance for the withdrawal queue
      const currentAllowance = await this.stETHContract.allowance(normalizedAddress, LIDO_CONTRACTS.WITHDRAWAL_QUEUE);
      const needsApproval = currentAllowance.lt(amountWei);

      this.logger.info(`Current allowance: ${ethers.utils.formatEther(currentAllowance)}, Needs approval: ${needsApproval}`);

      if (needsApproval) {
        this.logger.info('Preparing stETH approval transaction for withdrawal queue');
        this.logger.info(`Approval details: user=${normalizedAddress}, spender=${LIDO_CONTRACTS.WITHDRAWAL_QUEUE}, amount=${amountWei.toString()}`);

        const stETHContract = new ethers.Contract(
          LIDO_CONTRACTS.STETH,
          STETH_ABI,
          this.ethereumConfig.getProvider()
        );

        // Check user's stETH balance first
        const userBalance = await this.stETHContract.balanceOf(normalizedAddress);
        this.logger.info(`User stETH balance: ${ethers.utils.formatEther(userBalance)} stETH (${userBalance.toString()} wei)`);

        if (userBalance.lt(amountWei)) {
          throw new Error(`Insufficient stETH balance. You have ${ethers.utils.formatEther(userBalance)} stETH but trying to unstake ${amount} stETH`);
        }

        const approveTxData = await stETHContract.populateTransaction.approve(
          LIDO_CONTRACTS.WITHDRAWAL_QUEUE,
          amountWei
        );

        transaction = {
          id: transactionId,
          userAddress: normalizedAddress,
          type: 'unstake_approval',
          amount,
          token: 'stETH',
          status: 'pending',
          transactionData: {
            to: approveTxData.to || LIDO_CONTRACTS.STETH,
            data: approveTxData.data || '0x',
            value: '0',
            gasLimit: '100000',
            chainId: this.ethereumConfig.getChainId()
          },
          timestamp: new Date(),
          requiresFollowUp: true,
          followUpAction: 'unstake'
        };

        this.logger.info(`Approval transaction prepared for signing: ${transactionId}`);
      } else {
        // Allowance is sufficient, prepare withdrawal request
        const withdrawalQueueContract = new ethers.Contract(
          LIDO_CONTRACTS.WITHDRAWAL_QUEUE,
          WITHDRAWAL_QUEUE_ABI,
          this.ethereumConfig.getProvider()
        );

        const txData = await withdrawalQueueContract.populateTransaction.requestWithdrawals(
          [amountWei],
          normalizedAddress
        );

        transaction = {
          id: transactionId,
          userAddress: normalizedAddress,
          type: 'unstake',
          amount,
          token: 'stETH',
          status: 'pending',
          transactionData: {
            to: txData.to || LIDO_CONTRACTS.WITHDRAWAL_QUEUE,
            data: txData.data || '0x',
            value: '0',
            gasLimit: '300000',
            chainId: this.ethereumConfig.getChainId()
          },
          timestamp: new Date()
        };

        this.logger.info(`Unstake transaction prepared for signing: ${transactionId}`);
      }

      try {
        await this.persistTransaction({
          tx: transaction,
          chainId: this.ethereumConfig.getChainId(),
          amountWei,
        });
      } catch (e) {
        this.logger.warn(`Failed to persist unstake transaction: ${e}`);
      }

      return transaction;
    } catch (error) {
      this.logger.error(`Error creating unstake transaction: ${error}`);
      throw error;
    }
  }

  async claimRewards(userAddress: string): Promise<StakingTransaction> {
    try {
      this.logger.info(`Creating claim rewards transaction for ${userAddress}`);
      
      const transactionId = this.generateTransactionId();
      const amountWei = ethers.BigNumber.from(0);

      this.logger.info('Preparing claim rewards transaction for client-side signing');

      // Note: Lido stETH is rebasing; "rewards" are reflected in balance automatically.
      // This endpoint prepares a no-op transfer (0) to self to support legacy UX flows.
      const stETHContract = new ethers.Contract(
        LIDO_CONTRACTS.STETH,
        STETH_ABI,
        this.ethereumConfig.getProvider()
      );

      const txData = await stETHContract.populateTransaction.transfer(userAddress, 0);

      const transaction: StakingTransaction = {
        id: transactionId,
        userAddress,
        type: 'claim_rewards',
        amount: '0',
        token: 'stETH',
        status: 'pending',
        transactionData: {
          to: txData.to || LIDO_CONTRACTS.STETH,
          data: txData.data || '0x',
          value: '0',
          gasLimit: '100000',
          chainId: this.ethereumConfig.getChainId()
        },
        timestamp: new Date()
      };
      
      this.logger.info(`Claim rewards transaction prepared for signing: ${transactionId}`);

      try {
        await this.persistTransaction({
          tx: transaction,
          chainId: this.ethereumConfig.getChainId(),
          amountWei,
        });
      } catch (e) {
        this.logger.warn(`Failed to persist claim rewards transaction: ${e}`);
      }

      return transaction;
    } catch (error) {
      this.logger.error(`Error creating claim rewards transaction: ${error}`);
      throw error;
    }
  }

  async getStakingPosition(userAddress: string): Promise<StakingPosition | null> {
    try {
      this.logger.info(`Getting staking position for ${userAddress}`);
      
      // Normalize address to proper checksum
      const normalizedAddress = ethers.utils.getAddress(userAddress);
      
      // Get stETH balance
      const stETHBalanceWei = await this.stETHContract.balanceOf(normalizedAddress);
      
      // Get wstETH balance
      const wstETHBalanceWei = await this.wstETHContract.balanceOf(normalizedAddress);
      const wstETHAsStEthWei = await this.wstETHContract.getStETHByWstETH(wstETHBalanceWei);
      
      // Get protocol info for APY
      const protocolInfo = await this.getProtocolInfo();
      
      // Total staked in stETH units (wei): stETH + (wstETH -> stETH)
      const totalStakedWei = stETHBalanceWei.add(wstETHAsStEthWei);
      
      if (totalStakedWei.isZero()) {
        return null;
      }

      const position: StakingPosition = {
        id: this.generatePositionId(userAddress),
        userAddress: normalizedAddress,
        // IMPORTANT: return wei strings (frontend formats by dividing by 1e18)
        stakedAmount: totalStakedWei.toString(),
        stETHBalance: stETHBalanceWei.toString(),
        wstETHBalance: wstETHBalanceWei.toString(),
        apy: protocolInfo.currentAPY,
        timestamp: new Date(),
        status: 'active'
      };

      try {
        const apyBps =
          typeof protocolInfo.currentAPY === 'number' && Number.isFinite(protocolInfo.currentAPY)
            ? Math.round(protocolInfo.currentAPY * 100)
            : null;
        await this.persistPosition({
          userAddress: normalizedAddress,
          chainId: this.ethereumConfig.getChainId(),
          stETHBalanceWei,
          wstETHBalanceWei,
          totalStakedWei,
          apyBps,
        });
      } catch (e) {
        this.logger.warn(`Failed to persist staking position: ${e}`);
      }

      this.logger.info(`Staking position retrieved for ${userAddress}`);
      return position;
    } catch (error) {
      this.logger.error(`Error getting staking position: ${error}`);
      throw error;
    }
  }

  async getStakingHistory(userAddress: string, limit: number = 50): Promise<StakingTransaction[]> {
    try {
      this.logger.info(`Getting staking history for ${userAddress} with limit ${limit}`);

      if (!this.db) {
        return [];
      }

      const normalizedAddress = ethers.utils.getAddress(userAddress);
      await this.upsertUser(normalizedAddress);

      const result = await this.db.query(
        `
          SELECT
            id,
            address,
            type,
            token,
            amount_input,
            status,
            tx_hash,
            tx_data,
            created_at
          FROM lido_transactions
          WHERE address = $1
          ORDER BY created_at DESC
          LIMIT $2
        `,
        [normalizedAddress, Math.max(1, Math.min(limit, 200))]
      );

      return result.rows.map((row: any) => ({
        id: String(row.id),
        userAddress: String(row.address),
        type: row.type,
        amount: String(row.amount_input),
        token: row.token,
        status: row.status,
        transactionHash: row.tx_hash || undefined,
        transactionData: row.tx_data || undefined,
        timestamp: new Date(row.created_at),
      }));
    } catch (error) {
      this.logger.error(`Error getting staking history: ${error}`);
      throw error;
    }
  }

  async getProtocolInfo(): Promise<LidoProtocolInfo> {
    try {
      this.logger.info('Getting Lido protocol information');
      
      // Get total staked ETH
      const totalPooledEther = await this.stETHContract.getTotalPooledEther();
      const totalStakedWei = totalPooledEther.toString();

      // Get current APR/APY (when available)
      const currentAPY = await this.getCurrentAPY();
      
      const protocolInfo: LidoProtocolInfo = {
        // IMPORTANT: return wei strings (frontend formats by dividing by 1e18)
        totalStaked: totalStakedWei,
        currentAPY,
        lastUpdate: new Date()
      };

      this.logger.info('Protocol information retrieved successfully');
      return protocolInfo;
    } catch (error) {
      this.logger.error(`Error getting protocol info: ${error}`);
      throw error;
    }
  }

  async getWithdrawalRequests(userAddress: string): Promise<WithdrawalRequest[]> {
    try {
      const normalizedAddress = ethers.utils.getAddress(userAddress);
      this.logger.info(`Getting withdrawal requests for ${normalizedAddress}`);

      const requestIds: ethers.BigNumber[] = await this.withdrawalQueueContract.getWithdrawalRequests(normalizedAddress);
      if (!requestIds.length) {
        return [];
      }

      const statuses: any[] = await this.withdrawalQueueContract.getWithdrawalStatus(requestIds);

      const requests: WithdrawalRequest[] = requestIds.map((id, idx) => {
        const s = statuses[idx];
        const timestampBn = s?.timestamp ?? s?.[3];
        return {
          requestId: id.toString(),
          amountOfStETHWei: (s?.amountOfStETH ?? s?.[0]).toString(),
          amountOfSharesWei: (s?.amountOfShares ?? s?.[1]).toString(),
          owner: String(s?.owner ?? s?.[2]),
          timestamp: Number(timestampBn?.toString?.() ?? timestampBn),
          isFinalized: Boolean(s?.isFinalized ?? s?.[4]),
          isClaimed: Boolean(s?.isClaimed ?? s?.[5]),
        };
      });

      if (this.db) {
        try {
          await this.upsertUser(normalizedAddress);
          await this.db.transaction(async (client) => {
            for (const r of requests) {
              await client.query(
                `
                  INSERT INTO lido_withdrawal_requests
                    (request_id, address, amount_steth_wei, amount_shares, request_timestamp, is_finalized, is_claimed, updated_at)
                  VALUES
                    ($1, $2, $3, $4, $5, $6, $7, NOW())
                  ON CONFLICT (request_id) DO UPDATE SET
                    address = EXCLUDED.address,
                    amount_steth_wei = EXCLUDED.amount_steth_wei,
                    amount_shares = EXCLUDED.amount_shares,
                    request_timestamp = EXCLUDED.request_timestamp,
                    is_finalized = EXCLUDED.is_finalized,
                    is_claimed = EXCLUDED.is_claimed,
                    updated_at = NOW()
                `,
                [
                  r.requestId,
                  normalizedAddress,
                  r.amountOfStETHWei,
                  r.amountOfSharesWei,
                  r.timestamp,
                  r.isFinalized,
                  r.isClaimed,
                ]
              );
            }
          });
        } catch (e) {
          this.logger.warn(`Failed to persist withdrawal requests: ${e}`);
        }
      }

      return requests;
    } catch (error) {
      this.logger.error(`Error getting withdrawal requests: ${error}`);
      throw error;
    }
  }

  async claimWithdrawals(userAddress: string, requestIds: string[]): Promise<StakingTransaction> {
    try {
      const normalizedAddress = ethers.utils.getAddress(userAddress);
      if (!requestIds?.length) {
        throw new Error('requestIds is required');
      }

      const ids = requestIds.map((id) => ethers.BigNumber.from(id));
      const transactionId = this.generateTransactionId();

      const lastCheckpointIndex = await this.withdrawalQueueContract.getLastCheckpointIndex();
      const hints: ethers.BigNumber[] = await this.withdrawalQueueContract.findCheckpointHints(ids, 0, lastCheckpointIndex);

      this.logger.info('Preparing claimWithdrawals transaction for client-side signing');
      const withdrawalQueue = new ethers.Contract(
        LIDO_CONTRACTS.WITHDRAWAL_QUEUE,
        WITHDRAWAL_QUEUE_ABI,
        this.ethereumConfig.getProvider()
      );

      const txData = await withdrawalQueue.populateTransaction.claimWithdrawals(ids, hints);

      const transaction: StakingTransaction = {
        id: transactionId,
        userAddress: normalizedAddress,
        type: 'withdrawal_claim',
        amount: '0',
        token: 'ETH',
        status: 'pending',
        transactionData: {
          to: txData.to || LIDO_CONTRACTS.WITHDRAWAL_QUEUE,
          data: txData.data || '0x',
          value: '0',
          gasLimit: '500000',
          chainId: this.ethereumConfig.getChainId(),
        },
        timestamp: new Date(),
      };

      try {
        await this.persistTransaction({
          tx: transaction,
          chainId: this.ethereumConfig.getChainId(),
          amountWei: ethers.BigNumber.from(0),
        });
      } catch (e) {
        this.logger.warn(`Failed to persist withdrawal claim transaction: ${e}`);
      }

      return transaction;
    } catch (error) {
      this.logger.error(`Error preparing claimWithdrawals transaction: ${error}`);
      throw error;
    }
  }

  async submitTransactionHash(transactionId: string, userAddress: string, transactionHash: string): Promise<void> {
    if (!this.db) return;

    const normalizedAddress = ethers.utils.getAddress(userAddress);
    await this.upsertUser(normalizedAddress);

    const result = await this.db.query(
      `
        UPDATE lido_transactions
        SET tx_hash = $3, updated_at = NOW()
        WHERE id = $1 AND address = $2
      `,
      [transactionId, normalizedAddress, transactionHash]
    );

    if (!result.rowCount) {
      throw new Error('Transaction not found');
    }
  }

  async getCurrentAPY(): Promise<number | null> {
    const parseApr = (value: unknown): number | null => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
      }
      return null;
    };

    try {
      // Primary: Lido stake UI endpoint
      const resp = await axios.get('https://stake.lido.fi/api/stats', { timeout: 8000 });
      const apr =
        parseApr(resp.data?.apr) ??
        parseApr(resp.data?.data?.apr) ??
        parseApr(resp.data?.result?.apr);

      if (apr != null) return apr;
    } catch (error) {
      this.logger.warn(`Failed to fetch APR from stake.lido.fi: ${error}`);
    }

    try {
      // Secondary: Lido public API
      const resp = await axios.get('https://api.lido.fi/v1/protocol/staking/apr/last', { timeout: 8000 });
      const apr =
        parseApr(resp.data?.apr) ??
        parseApr(resp.data?.data?.apr) ??
        parseApr(resp.data?.result?.apr);

      if (apr != null) return apr;
    } catch (error) {
      this.logger.warn(`Failed to fetch APR from api.lido.fi: ${error}`);
    }

    return null;
  }

  async getTransactionStatus(transactionHash: string): Promise<StakingTransaction | null> {
    try {
      this.logger.info(`Getting transaction status for ${transactionHash}`);

      const provider = this.ethereumConfig.getProvider();
      const receipt = await provider.getTransactionReceipt(transactionHash);

      let txFromDb: any | null = null;
      if (this.db) {
        try {
          const res = await this.db.query(
            `
              SELECT id, address, type, token, amount_input, status, tx_hash, tx_data, created_at
              FROM lido_transactions
              WHERE tx_hash = $1
              ORDER BY created_at DESC
              LIMIT 1
            `,
            [transactionHash]
          );
          txFromDb = res.rows[0] ?? null;
        } catch (e) {
          this.logger.warn(`Failed to load tx from DB: ${e}`);
        }
      }

      const status: 'pending' | 'completed' | 'failed' =
        receipt == null ? 'pending' : receipt.status === 1 ? 'completed' : 'failed';

      const tx: StakingTransaction = {
        id: txFromDb?.id ? String(txFromDb.id) : `tx_${transactionHash.slice(2, 10)}`,
        userAddress: txFromDb?.address ? String(txFromDb.address) : '0x0000000000000000000000000000000000000000',
        type: (txFromDb?.type as any) || 'stake',
        amount: txFromDb?.amount_input ? String(txFromDb.amount_input) : '0',
        token: (txFromDb?.token as any) || 'ETH',
        transactionHash,
        blockNumber: receipt?.blockNumber ?? undefined,
        gasUsed: receipt?.gasUsed?.toString?.() ?? undefined,
        status,
        timestamp: txFromDb?.created_at ? new Date(txFromDb.created_at) : new Date(),
        transactionData: txFromDb?.tx_data || undefined,
      };

      if (this.db) {
        try {
          await this.db.query(
            `UPDATE lido_transactions SET status = $2, updated_at = NOW() WHERE tx_hash = $1`,
            [transactionHash, status]
          );
        } catch (e) {
          this.logger.warn(`Failed to update tx status in DB: ${e}`);
        }
      }

      return tx;
    } catch (error) {
      this.logger.error(`Error getting transaction status: ${error}`);
      throw error;
    }
  }

  async updateTransactionStatus(transactionHash: string, status: 'pending' | 'completed' | 'failed'): Promise<void> {
    try {
      this.logger.info(`Updating transaction status for ${transactionHash} to ${status}`);

      if (!this.db) return;
      await this.db.query(
        `UPDATE lido_transactions SET status = $2, updated_at = NOW() WHERE tx_hash = $1`,
        [transactionHash, status]
      );
    } catch (error) {
      this.logger.error(`Error updating transaction status: ${error}`);
      throw error;
    }
  }

  async getPortfolioAssets(userAddress: string): Promise<PortfolioAsset[]> {
    const normalizedAddress = ethers.utils.getAddress(userAddress);

    // If persistence is enabled, prefer DB (fast + consistent with daily metrics)
    if (this.db) {
      try {
        await this.upsertUser(normalizedAddress);
        const res = await this.db.query(
          `
            SELECT chain_id, token_symbol, token_address, balance_wei, updated_at
            FROM lido_portfolio_assets
            WHERE address = $1
            ORDER BY token_symbol ASC
          `,
          [normalizedAddress]
        );

        return res.rows.map((row: any) => ({
          chainId: Number(row.chain_id),
          tokenSymbol: String(row.token_symbol),
          tokenAddress: String(row.token_address),
          balanceWei: String(row.balance_wei),
          updatedAt: new Date(row.updated_at),
        }));
      } catch (error) {
        this.logger.warn(`Failed to load portfolio assets from DB, falling back to on-chain: ${error}`);
      }
    }

    // Fallback: on-chain snapshot (real-time, but no history)
    const position = await this.getStakingPosition(normalizedAddress);
    if (!position) return [];

    const now = new Date();
    return [
      {
        chainId: this.ethereumConfig.getChainId(),
        tokenSymbol: 'stETH',
        tokenAddress: LIDO_CONTRACTS.STETH,
        balanceWei: position.stETHBalance,
        updatedAt: now,
      },
      {
        chainId: this.ethereumConfig.getChainId(),
        tokenSymbol: 'wstETH',
        tokenAddress: LIDO_CONTRACTS.WSTETH,
        balanceWei: position.wstETHBalance,
        updatedAt: now,
      },
    ];
  }

  async getPortfolioDailyMetrics(userAddress: string, days: number): Promise<PortfolioMetricDaily[]> {
    const normalizedAddress = ethers.utils.getAddress(userAddress);
    const safeDays = Math.max(1, Math.min(days || 30, 365));

    if (!this.db) return [];

    await this.upsertUser(normalizedAddress);
    const res = await this.db.query(
      `
        SELECT chain_id, date, steth_balance_wei, wsteth_balance_wei, total_staked_wei, apy_bps, updated_at
        FROM lido_portfolio_metrics_daily
        WHERE address = $1
          AND date >= (CURRENT_DATE - ($2::int - 1))
        ORDER BY date DESC
      `,
      [normalizedAddress, safeDays]
    );

    const toDateString = (value: any): string => {
      if (!value) return '';
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      return String(value).slice(0, 10);
    };

    return res.rows.map((row: any) => ({
      chainId: Number(row.chain_id),
      date: toDateString(row.date),
      stethBalanceWei: String(row.steth_balance_wei),
      wstethBalanceWei: String(row.wsteth_balance_wei),
      totalStakedWei: String(row.total_staked_wei),
      apyBps: row.apy_bps == null ? null : Number(row.apy_bps),
      updatedAt: new Date(row.updated_at),
    }));
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePositionId(userAddress: string): string {
    return `pos_${userAddress.slice(0, 8)}_${Date.now()}`;
  }
}

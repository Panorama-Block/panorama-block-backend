import { Request, Response } from 'express';
import { LidoService } from '../../../application/services/LidoService';
import { StakeUseCase } from '../../../application/usecases/StakeUseCase';
import { UnstakeUseCase } from '../../../application/usecases/UnstakeUseCase';
import { GetPositionUseCase } from '../../../application/usecases/GetPositionUseCase';
import { Logger } from '../../logs/logger';

export class LidoController {
  private lidoService!: LidoService;
  private stakeUseCase!: StakeUseCase;
  private unstakeUseCase!: UnstakeUseCase;
  private getPositionUseCase!: GetPositionUseCase;
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
    this.initializeServices();
  }

  private initializeServices(): void {
    // In a real implementation, these would be injected via dependency injection
    // For now, we'll create them directly
    const { LidoRepository } = require('../../repositories/LidoRepository');
    const lidoRepository = new LidoRepository();
    
    this.lidoService = new LidoService(lidoRepository, this.logger);
    this.stakeUseCase = new StakeUseCase(this.lidoService);
    this.unstakeUseCase = new UnstakeUseCase(this.lidoService);
    this.getPositionUseCase = new GetPositionUseCase(this.lidoService);
  }

  async stake(req: Request, res: Response): Promise<void> {
    try {
      const { userAddress, amount } = req.body;

      if (!userAddress || !amount) {
        this.logger.error('❌ Missing required parameters for stake');
        res.status(400).json({
          success: false,
          error: 'User address and amount are required'
        });
        return;
      }

      this.logger.info('🎯 Stake request', {
        userAddress,
        amount
      });

      const result = await this.stakeUseCase.execute({ userAddress, amount });

      this.logger.info(`📊 Stake UseCase result: ${JSON.stringify(result, null, 2)}`);

      if (result.success) {
        this.logger.info('✅ Stake successful, returning transaction data');
        res.status(200).json({
          success: true,
          data: result.transaction
        });
      } else {
        this.logger.error(`❌ Stake failed: ${result.error}`);
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      this.logger.error(`❌ Error in stake controller: ${error}`);
      this.logger.error(`   Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async unstake(req: Request, res: Response): Promise<void> {
    try {
      const { userAddress, amount } = req.body;

      if (!userAddress || !amount) {
        this.logger.error('❌ Missing required parameters');
        res.status(400).json({
          success: false,
          error: 'User address and amount are required'
        });
        return;
      }

      this.logger.info('🎯 Unstake request', {
        userAddress,
        amount
      });

      const result = await this.unstakeUseCase.execute({ userAddress, amount });

      this.logger.info(`📊 Unstake UseCase result:`);
      this.logger.info(`   success: ${result.success}`);
      this.logger.info(`   transaction type: ${result.transaction?.type}`);
      this.logger.info(`   transaction data: ${JSON.stringify(result.transaction?.transactionData, null, 2)}`);
      this.logger.info(`   requiresFollowUp: ${result.transaction?.requiresFollowUp}`);

      if (result.success) {
        this.logger.info('✅ Unstake successful, returning transaction data');
        res.status(200).json({
          success: true,
          data: result.transaction
        });
      } else {
        this.logger.error(`❌ Unstake failed: ${result.error}`);
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      this.logger.error(`❌ Error in unstake controller: ${error}`);
      this.logger.error(`   Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async claimRewards(req: Request, res: Response): Promise<void> {
    try {
      const { userAddress } = req.body;

      if (!userAddress) {
        res.status(400).json({
          success: false,
          error: 'User address is required'
        });
        return;
      }

      const transaction = await this.lidoService.claimRewards(userAddress);

      res.status(200).json({
        success: true,
        data: transaction
      });
    } catch (error) {
      this.logger.error(`Error in claimRewards controller: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getPosition(req: Request, res: Response): Promise<void> {
    try {
      const { userAddress } = req.params;

      if (!userAddress) {
        res.status(400).json({
          success: false,
          error: 'User address is required'
        });
        return;
      }

      const result = await this.getPositionUseCase.execute({ userAddress });

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.position
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      this.logger.error(`Error in getPosition controller: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getStakingHistory(req: Request, res: Response): Promise<void> {
    try {
      const { userAddress } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!userAddress) {
        res.status(400).json({
          success: false,
          error: 'User address is required'
        });
        return;
      }

      const history = await this.lidoService.getStakingHistory(userAddress, limit);

      res.status(200).json({
        success: true,
        data: history
      });
    } catch (error) {
      this.logger.error(`Error in getStakingHistory controller: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getPortfolio(req: Request, res: Response): Promise<void> {
    try {
      const { userAddress } = req.params;
      const days = Math.max(1, Math.min(parseInt(req.query.days as string) || 30, 365));

      if (!userAddress) {
        res.status(400).json({
          success: false,
          error: 'User address is required',
        });
        return;
      }

      const [assets, dailyMetrics] = await Promise.all([
        this.lidoService.getPortfolioAssets(userAddress),
        this.lidoService.getPortfolioDailyMetrics(userAddress, days),
      ]);

      res.status(200).json({
        success: true,
        data: {
          userAddress,
          assets,
          dailyMetrics,
        },
      });
    } catch (error) {
      this.logger.error(`Error in getPortfolio controller: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async getWithdrawals(req: Request, res: Response): Promise<void> {
    try {
      const { userAddress } = req.params;

      if (!userAddress) {
        res.status(400).json({
          success: false,
          error: 'User address is required',
        });
        return;
      }

      const requests = await this.lidoService.getWithdrawalRequests(userAddress);

      res.status(200).json({
        success: true,
        data: requests,
      });
    } catch (error) {
      this.logger.error(`Error in getWithdrawals controller: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async claimWithdrawals(req: Request, res: Response): Promise<void> {
    try {
      const { userAddress, requestIds } = req.body as {
        userAddress?: string;
        requestIds?: string[];
      };

      if (!userAddress || !requestIds?.length) {
        res.status(400).json({
          success: false,
          error: 'userAddress and requestIds are required',
        });
        return;
      }

      const transaction = await this.lidoService.claimWithdrawals(userAddress, requestIds);

      res.status(200).json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      this.logger.error(`Error in claimWithdrawals controller: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async submitTransactionHash(req: Request, res: Response): Promise<void> {
    try {
      const { id, userAddress, transactionHash } = req.body as {
        id?: string;
        userAddress?: string;
        transactionHash?: string;
      };

      if (!id || !userAddress || !transactionHash) {
        res.status(400).json({
          success: false,
          error: 'id, userAddress and transactionHash are required',
        });
        return;
      }

      await this.lidoService.submitTransactionHash(id, userAddress, transactionHash);

      res.status(200).json({
        success: true,
        data: { id, transactionHash },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error in submitTransactionHash controller: ${message}`);
      res.status(message === 'Transaction not found' ? 404 : 500).json({
        success: false,
        error: message === 'Transaction not found' ? message : 'Internal server error',
      });
    }
  }

  async getProtocolInfo(req: Request, res: Response): Promise<void> {
    try {
      const protocolInfo = await this.lidoService.getProtocolInfo();

      res.status(200).json({
        success: true,
        data: protocolInfo
      });
    } catch (error) {
      this.logger.error(`Error in getProtocolInfo controller: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getTransactionStatus(req: Request, res: Response): Promise<void> {
    try {
      const { transactionHash } = req.params;

      if (!transactionHash) {
        res.status(400).json({
          success: false,
          error: 'Transaction hash is required'
        });
        return;
      }

      const transaction = await this.lidoService.getTransactionStatus(transactionHash);

      if (transaction) {
        res.status(200).json({
          success: true,
          data: transaction
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Transaction not found'
        });
      }
    } catch (error) {
      this.logger.error(`Error in getTransactionStatus controller: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

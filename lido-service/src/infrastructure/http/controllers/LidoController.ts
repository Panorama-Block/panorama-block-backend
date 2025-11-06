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
      this.logger.info('🎯 Stake Controller - Request received:');
      this.logger.info(`   Headers: ${JSON.stringify(req.headers, null, 2)}`);
      this.logger.info(`   Body: ${JSON.stringify(req.body, null, 2)}`);
      this.logger.info(`   User: ${JSON.stringify((req as any).user, null, 2)}`);
      
      const { userAddress, amount, privateKey } = req.body;

      if (!userAddress || !amount) {
        this.logger.error('❌ Missing required parameters:');
        this.logger.error(`   userAddress: ${userAddress}`);
        this.logger.error(`   amount: ${amount}`);
        res.status(400).json({
          success: false,
          error: 'User address and amount are required'
        });
        return;
      }

      this.logger.info(`✅ Parameters validated - userAddress: ${userAddress}, amount: ${amount}, privateKey: ${privateKey ? 'provided' : 'not provided'}`);

      const result = await this.stakeUseCase.execute({ userAddress, amount, privateKey });

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
      const { userAddress, amount, privateKey } = req.body;

      if (!userAddress || !amount) {
        res.status(400).json({
          success: false,
          error: 'User address and amount are required'
        });
        return;
      }

      const result = await this.unstakeUseCase.execute({ userAddress, amount, privateKey });

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.transaction
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      this.logger.error(`Error in unstake controller: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async claimRewards(req: Request, res: Response): Promise<void> {
    try {
      const { userAddress, privateKey } = req.body;

      if (!userAddress) {
        res.status(400).json({
          success: false,
          error: 'User address is required'
        });
        return;
      }

      const transaction = await this.lidoService.claimRewards(userAddress, privateKey);

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

import { Request, Response } from 'express';
import { GetPositionsUseCase } from '../../../application/usecases/positions/get-positions.usecase';
import { CreatePositionUseCase } from '../../../application/usecases/positions/create-position.usecase';
import { AuthenticatedRequest } from '../../../@types/auth';
import { validateSchema } from '../../../utils/validation.utils';
import { z } from 'zod';

const GetPositionsSchema = z.object({
  query: z.object({
    chainId: z.string().optional().transform(val => val ? parseInt(val) : undefined),
    includeInactive: z.string().optional().transform(val => val === 'true'),
    protocol: z.enum(['v2', 'v3', 'v4']).optional()
  })
});

const CreatePositionSchema = z.object({
  body: z.object({
    protocol: z.enum(['v2', 'v3', 'v4']),
    chainId: z.number().min(1),
    token0: z.string().min(1),
    token1: z.string().min(1),
    amount0: z.string().min(1),
    amount1: z.string().min(1),
    priceRange: z.object({
      lower: z.number().positive(),
      upper: z.number().positive()
    }).optional(),
    feeTier: z.number().optional(),
    hookAddress: z.string().optional(),
    slippageTolerance: z.number().min(0).max(100).optional()
  })
});

export class PositionsController {
  constructor(
    private readonly getPositionsUseCase: GetPositionsUseCase,
    private readonly createPositionUseCase: CreatePositionUseCase
  ) {}

  async getPositions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userAddress = req.user!.wallet_address;

      const { query } = validateSchema(GetPositionsSchema, req);

      const result = await this.getPositionsUseCase.execute({
        userAddress,
        chainId: query.chainId,
        includeInactive: query.includeInactive,
        protocol: query.protocol
      });

      res.status(200).json({
        success: true,
        data: result,
        meta: {
          userAddress,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('[PositionsController] Error getting positions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get positions',
        message: error.message
      });
    }
  }

  async createPosition(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userAddress = req.user!.wallet_address;

      const { body } = validateSchema(CreatePositionSchema, req);

      const result = await this.createPositionUseCase.execute({
        ...body,
        userAddress
      });

      res.status(200).json({
        success: true,
        data: result,
        meta: {
          userAddress,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('[PositionsController] Error creating position:', error);

      // Handle specific errors
      if (error.message.includes('Hook') && error.message.includes('interfere')) {
        res.status(400).json({
          success: false,
          error: 'Hook validation failed',
          message: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create position',
        message: error.message
      });
    }
  }

  async getPositionById(req: Request, res: Response): Promise<void> {
    try {
      const { positionId } = req.params;

      // TODO: Implement get position by ID use case
      res.status(501).json({
        success: false,
        error: 'Not implemented',
        message: 'Get position by ID endpoint not implemented yet'
      });
    } catch (error: any) {
      console.error('[PositionsController] Error getting position by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get position',
        message: error.message
      });
    }
  }

  async increasePosition(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { positionId } = req.params;

      // TODO: Implement increase position use case
      res.status(501).json({
        success: false,
        error: 'Not implemented',
        message: 'Increase position endpoint not implemented yet'
      });
    } catch (error: any) {
      console.error('[PositionsController] Error increasing position:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to increase position',
        message: error.message
      });
    }
  }

  async decreasePosition(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { positionId } = req.params;

      // TODO: Implement decrease position use case
      res.status(501).json({
        success: false,
        error: 'Not implemented',
        message: 'Decrease position endpoint not implemented yet'
      });
    } catch (error: any) {
      console.error('[PositionsController] Error decreasing position:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to decrease position',
        message: error.message
      });
    }
  }

  async collectFees(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { positionId } = req.params;

      // TODO: Implement collect fees use case
      res.status(501).json({
        success: false,
        error: 'Not implemented',
        message: 'Collect fees endpoint not implemented yet'
      });
    } catch (error: any) {
      console.error('[PositionsController] Error collecting fees:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to collect fees',
        message: error.message
      });
    }
  }
}
import { Request, Response } from 'express';
import { HooksDetectorAdapter } from '../../adapters/hooks-detector.adapter';
import { validateSchema } from '../../../utils/validation.utils';
import { z } from 'zod';

const ValidateHookSchema = z.object({
  body: z.object({
    hookAddress: z.string().min(1),
    chainId: z.number().min(1),
    operation: z.enum(['addLiquidity', 'removeLiquidity', 'swap', 'collect']).optional()
  })
});

const GetHooksSchema = z.object({
  query: z.object({
    chainId: z.string().transform(val => parseInt(val)),
    category: z.string().optional(),
    verified: z.string().optional().transform(val => val === 'true'),
    limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
    offset: z.string().optional().transform(val => val ? parseInt(val) : 0)
  })
});

export class HooksController {
  constructor(
    private readonly hooksDetector: HooksDetectorAdapter
  ) {}

  async validateHook(req: Request, res: Response): Promise<void> {
    try {
      const { body } = validateSchema(ValidateHookSchema, req);

      const hookValidation = await this.hooksDetector.validateHook(
        body.hookAddress,
        body.chainId
      );

      let operationSafety;
      if (body.operation) {
        operationSafety = await this.hooksDetector.isHookSafeForOperation(
          body.hookAddress,
          body.operation,
          body.chainId
        );
      }

      res.status(200).json({
        success: true,
        data: {
          hook: hookValidation,
          operationSafety: body.operation ? {
            operation: body.operation,
            isSafe: operationSafety
          } : undefined
        },
        meta: {
          hookAddress: body.hookAddress,
          chainId: body.chainId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('[HooksController] Error validating hook:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate hook',
        message: error.message
      });
    }
  }

  async getHooks(req: Request, res: Response): Promise<void> {
    try {
      const { query } = validateSchema(GetHooksSchema, req);

      const hooks = await this.hooksDetector.getAvailableHooks(
        query.chainId,
        {
          category: query.category,
          verified: query.verified,
          limit: query.limit,
          offset: query.offset
        }
      );

      res.status(200).json({
        success: true,
        data: {
          hooks: hooks.hooks,
          pagination: hooks.pagination
        },
        meta: {
          chainId: query.chainId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('[HooksController] Error getting hooks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get hooks',
        message: error.message
      });
    }
  }

  async getHookById(req: Request, res: Response): Promise<void> {
    try {
      const { hookAddress } = req.params;
      const chainId = parseInt(req.query.chainId as string);

      if (!chainId) {
        res.status(400).json({
          success: false,
          error: 'Chain ID is required',
          message: 'Please provide chainId query parameter'
        });
        return;
      }

      const hookValidation = await this.hooksDetector.validateHook(hookAddress, chainId);

      res.status(200).json({
        success: true,
        data: {
          hook: hookValidation
        },
        meta: {
          hookAddress,
          chainId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('[HooksController] Error getting hook by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get hook',
        message: error.message
      });
    }
  }

  async getHookCategories(req: Request, res: Response): Promise<void> {
    try {
      const chainId = parseInt(req.query.chainId as string);

      if (!chainId) {
        res.status(400).json({
          success: false,
          error: 'Chain ID is required',
          message: 'Please provide chainId query parameter'
        });
        return;
      }

      // Mock categories for now
      const categories = [
        {
          id: 'yield',
          name: 'Yield Enhancement',
          description: 'Hooks that enhance yield generation',
          count: 5
        },
        {
          id: 'protection',
          name: 'Protection',
          description: 'Hooks that provide additional protection mechanisms',
          count: 3
        },
        {
          id: 'automation',
          name: 'Automation',
          description: 'Hooks that automate position management',
          count: 7
        },
        {
          id: 'utility',
          name: 'Utility',
          description: 'General utility hooks',
          count: 4
        }
      ];

      res.status(200).json({
        success: true,
        data: {
          categories
        },
        meta: {
          chainId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('[HooksController] Error getting hook categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get hook categories',
        message: error.message
      });
    }
  }
}
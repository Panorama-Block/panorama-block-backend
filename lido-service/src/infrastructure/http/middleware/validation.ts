import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../logs/logger';

export class ValidationMiddleware {
  private static logger = new Logger();

  static validateStakeRequest(req: Request, res: Response, next: NextFunction): void {
    const { userAddress, amount } = req.body;

    if (!userAddress) {
      res.status(400).json({
        success: false,
        error: 'User address is required'
      });
      return;
    }

    if (!amount) {
      res.status(400).json({
        success: false,
        error: 'Amount is required'
      });
      return;
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address format'
      });
      return;
    }

    // Validate amount is a positive number
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      res.status(400).json({
        success: false,
        error: 'Amount must be a positive number'
      });
      return;
    }

    // Validate amount is not too large (prevent overflow)
    if (amountNum > 1000000) {
      res.status(400).json({
        success: false,
        error: 'Amount too large (maximum 1,000,000 ETH)'
      });
      return;
    }

    next();
  }

  static validateUnstakeRequest(req: Request, res: Response, next: NextFunction): void {
    const { userAddress, amount } = req.body;

    if (!userAddress) {
      res.status(400).json({
        success: false,
        error: 'User address is required'
      });
      return;
    }

    if (!amount) {
      res.status(400).json({
        success: false,
        error: 'Amount is required'
      });
      return;
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address format'
      });
      return;
    }

    // Validate amount is a positive number
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      res.status(400).json({
        success: false,
        error: 'Amount must be a positive number'
      });
      return;
    }

    next();
  }

  static validateUserAddress(req: Request, res: Response, next: NextFunction): void {
    const { userAddress } = req.params;

    if (!userAddress) {
      res.status(400).json({
        success: false,
        error: 'User address is required'
      });
      return;
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address format'
      });
      return;
    }

    next();
  }

  static validateTransactionHash(req: Request, res: Response, next: NextFunction): void {
    const { transactionHash } = req.params;

    if (!transactionHash) {
      res.status(400).json({
        success: false,
        error: 'Transaction hash is required'
      });
      return;
    }

    // Validate transaction hash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash)) {
      res.status(400).json({
        success: false,
        error: 'Invalid transaction hash format'
      });
      return;
    }

    next();
  }
}

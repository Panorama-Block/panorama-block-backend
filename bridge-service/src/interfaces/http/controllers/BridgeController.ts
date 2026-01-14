import { Request, Response, NextFunction } from 'express';
import { CreateBridgeTransactionUseCase } from '../../../application/use-cases/CreateBridgeTransactionUseCase';
import { GetBridgeQuoteUseCase } from '../../../application/use-cases/GetBridgeQuoteUseCase';
import { GetBridgeStatusUseCase } from '../../../application/use-cases/GetBridgeStatusUseCase';
import { z } from 'zod';

const CreateBridgeTransactionSchema = z.object({
    amount: z.number().positive(),
    destinationAddress: z.string().min(1),
    sourceNetwork: z.string().min(1),
    destinationNetwork: z.string().min(1),
    sourceAddress: z.string().optional(),
    refuel: z.boolean().optional(),
});

const GetBridgeQuoteSchema = z.object({
    amount: z.number().positive(),
    sourceNetwork: z.string().min(1),
    destinationNetwork: z.string().min(1),
    refuel: z.boolean().optional(),
});

export class BridgeController {
    constructor(
        private readonly createBridgeTransactionUseCase: CreateBridgeTransactionUseCase,
        private readonly getBridgeQuoteUseCase: GetBridgeQuoteUseCase,
        private readonly getBridgeStatusUseCase: GetBridgeStatusUseCase,
    ) { }

    async getBridgeQuote(req: Request, res: Response, next: NextFunction) {
        try {
            const { amount, sourceNetwork, destinationNetwork, refuel } = GetBridgeQuoteSchema.parse(req.body);
            console.log(`[BridgeController] getBridgeQuote: amount=${amount}, source=${sourceNetwork}, dest=${destinationNetwork}, refuel=${refuel}`);
            const result = await this.getBridgeQuoteUseCase.execute(amount, sourceNetwork, destinationNetwork, refuel);
            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }

    async createBridgeTransaction(req: Request, res: Response, next: NextFunction) {
        try {
            const { amount, destinationAddress, sourceNetwork, destinationNetwork, sourceAddress, refuel } = CreateBridgeTransactionSchema.parse(req.body);
            console.log(`[BridgeController] createBridgeTransaction: amount=${amount}, destAddr=${destinationAddress}, source=${sourceNetwork}, dest=${destinationNetwork}, sourceAddr=${sourceAddress}, refuel=${refuel}`);
            const result = await this.createBridgeTransactionUseCase.execute(amount, destinationAddress, sourceNetwork, destinationNetwork, sourceAddress, refuel);

            res.status(201).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }

    async getBridgeStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const swapId = z.string().min(1).parse(req.params.swapId);
            const result = await this.getBridgeStatusUseCase.execute(swapId);
            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }
}

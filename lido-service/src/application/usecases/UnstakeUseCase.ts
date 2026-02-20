import { LidoService } from '../services/LidoService';
import { StakingTransaction } from '../../domain/entities/StakingPosition';

export interface UnstakeRequest {
  userAddress: string;
  amount: string;
}

export interface UnstakeResponse {
  success: boolean;
  transaction?: StakingTransaction;
  error?: string;
}

export class UnstakeUseCase {
  constructor(private lidoService: LidoService) {}

  async execute(request: UnstakeRequest): Promise<UnstakeResponse> {
    try {
      const transaction = await this.lidoService.unstake(request.userAddress, request.amount);
      
      return {
        success: true,
        transaction
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

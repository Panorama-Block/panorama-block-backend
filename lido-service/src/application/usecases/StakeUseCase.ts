import { LidoService } from '../services/LidoService';
import { StakingTransaction } from '../../domain/entities/StakingPosition';

export interface StakeRequest {
  userAddress: string;
  amount: string;
  privateKey?: string;
}

export interface StakeResponse {
  success: boolean;
  transaction?: StakingTransaction;
  error?: string;
}

export class StakeUseCase {
  constructor(private lidoService: LidoService) {}

  async execute(request: StakeRequest): Promise<StakeResponse> {
    try {
      const transaction = await this.lidoService.stake(request.userAddress, request.amount, request.privateKey);
      
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

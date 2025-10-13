import { LidoService } from '../services/LidoService';
import { StakingPosition } from '../../domain/entities/StakingPosition';

export interface GetPositionRequest {
  userAddress: string;
}

export interface GetPositionResponse {
  success: boolean;
  position?: StakingPosition;
  error?: string;
}

export class GetPositionUseCase {
  constructor(private lidoService: LidoService) {}

  async execute(request: GetPositionRequest): Promise<GetPositionResponse> {
    try {
      const position = await this.lidoService.getStakingPosition(request.userAddress);
      
      return {
        success: true,
        position: position || undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

import { describe, expect, test, vi } from 'vitest';
import { StakeUseCase } from '../StakeUseCase';
import { UnstakeUseCase } from '../UnstakeUseCase';
import { GetPositionUseCase } from '../GetPositionUseCase';

describe('Lido usecases', () => {
  test('StakeUseCase passes through success and maps errors', async () => {
    const lidoService = {
      stake: vi.fn().mockResolvedValue({ id: 'tx_1', amount: '1' }),
    } as any;

    const useCase = new StakeUseCase(lidoService);
    await expect(useCase.execute({ userAddress: '0x1', amount: '1' })).resolves.toEqual({
      success: true,
      transaction: { id: 'tx_1', amount: '1' },
    });

    lidoService.stake.mockRejectedValueOnce(new Error('invalid amount'));
    await expect(useCase.execute({ userAddress: '0x1', amount: '0' })).resolves.toEqual({
      success: false,
      error: 'invalid amount',
    });
  });

  test('UnstakeUseCase passes through success and maps errors', async () => {
    const lidoService = {
      unstake: vi.fn().mockResolvedValue({ id: 'tx_2', amount: '2' }),
    } as any;

    const useCase = new UnstakeUseCase(lidoService);
    await expect(useCase.execute({ userAddress: '0x2', amount: '2' })).resolves.toEqual({
      success: true,
      transaction: { id: 'tx_2', amount: '2' },
    });

    lidoService.unstake.mockRejectedValueOnce(new Error('insufficient stETH balance'));
    await expect(useCase.execute({ userAddress: '0x2', amount: '5' })).resolves.toEqual({
      success: false,
      error: 'insufficient stETH balance',
    });
  });

  test('GetPositionUseCase returns position or undefined and maps errors', async () => {
    const lidoService = {
      getStakingPosition: vi.fn().mockResolvedValue({
        id: 'pos_1',
        stETHBalance: '100',
      }),
    } as any;

    const useCase = new GetPositionUseCase(lidoService);
    await expect(useCase.execute({ userAddress: '0x3' })).resolves.toEqual({
      success: true,
      position: { id: 'pos_1', stETHBalance: '100' },
    });

    lidoService.getStakingPosition.mockResolvedValueOnce(null);
    await expect(useCase.execute({ userAddress: '0x3' })).resolves.toEqual({
      success: true,
      position: undefined,
    });

    lidoService.getStakingPosition.mockRejectedValueOnce(new Error('rpc unavailable'));
    await expect(useCase.execute({ userAddress: '0x3' })).resolves.toEqual({
      success: false,
      error: 'rpc unavailable',
    });
  });
});

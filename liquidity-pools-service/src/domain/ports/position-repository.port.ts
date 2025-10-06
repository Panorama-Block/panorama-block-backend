import { Position } from '../entities/position.entity';

export interface IPositionRepository {
  findByOwner(owner: string, chainId?: number): Promise<Position[]>;
  findById(id: string): Promise<Position | null>;
  save(position: Position): Promise<Position>;
  delete(id: string): Promise<boolean>;
}
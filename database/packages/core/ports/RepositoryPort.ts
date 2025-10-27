import { RequestCtx } from './RequestCtx.js';

export interface Query {
  where?: Record<string, unknown>;
  select?: string[] | Record<string, boolean>;
  include?: Record<string, boolean>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  cursor?: Record<string, unknown>;
  take?: number;
  skip?: number;
  distinct?: string[];
}

export type TransactionOp =
  | { op: 'create'; entity: string; args: { data: Record<string, unknown> } }
  | { op: 'update'; entity: string; args: { id: unknown; data: Record<string, unknown> } }
  | { op: 'delete'; entity: string; args: { id: unknown } };

export interface RepositoryPort {
  list(entity: string, q: Query, ctx: RequestCtx): Promise<{ data: any[]; page?: any }>;
  get(entity: string, id: any, ctx: RequestCtx): Promise<any | null>;
  create(entity: string, data: Record<string, unknown>, ctx: RequestCtx): Promise<any>;
  update(entity: string, id: any, data: Record<string, unknown>, ctx: RequestCtx): Promise<any>;
  delete(entity: string, id: any, ctx: RequestCtx): Promise<void>;
  transact(ops: TransactionOp[], ctx: RequestCtx): Promise<any[]>;
  searchEmbedding?(
    entity: string,
    embedding: number[],
    k: number,
    filter?: Record<string, unknown>,
    ctx?: RequestCtx
  ): Promise<any[]>;
}

export type RepositoryFactory = () => RepositoryPort;

export interface ActorCtx {
  id?: string;
  roles?: string[];
  service?: string;
  metadata?: Record<string, unknown>;
}

export interface RequestCtx {
  requestId: string;
  tenantId?: string;
  actor?: ActorCtx;
  headers?: Record<string, string | string[] | undefined>;
}

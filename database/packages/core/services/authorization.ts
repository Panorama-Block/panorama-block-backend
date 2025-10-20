import { EntityAction, EntityConfig } from '../entities.js';
import { ForbiddenError } from './errors.js';
import { RequestCtx } from '../ports/index.js';

export const ensureAuthorized = (
  config: EntityConfig,
  action: EntityAction,
  ctx: RequestCtx
): void => {
  const requiredRoles = config.allowedRoles?.[action];
  if (!requiredRoles || requiredRoles.length === 0) {
    return;
  }

  const roles = ctx.actor?.roles ?? [];
  const hasRole = roles.some((role) => requiredRoles.includes(role));
  if (!hasRole) {
    throw new ForbiddenError(`Actor lacks required role for ${config.collection}:${action}`);
  }
};

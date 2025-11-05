import { z } from 'zod';
import { Query } from '../core/ports/index.js';

const jsonKeys = new Set(['where', 'orderBy', 'cursor', 'include', 'select', 'distinct']);
const numberKeys = new Set(['take', 'skip']);

export const parseQueryParams = (raw: Record<string, any>, schema: z.ZodTypeAny): Query => {
  const working: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    if (jsonKeys.has(key)) {
      try {
        working[key] = typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        throw new Error(`Invalid JSON for ${key}`);
      }
    } else if (numberKeys.has(key)) {
      const numberValue = Number(value);
      if (Number.isNaN(numberValue)) {
        throw new Error(`Invalid number for ${key}`);
      }
      working[key] = numberValue;
    } else {
      working[key] = value;
    }
  }

  return schema.parse(working);
};

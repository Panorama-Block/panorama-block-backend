import { z } from 'zod';

export function validateSchema<T extends z.ZodType>(
  schema: T,
  data: any
): z.infer<T> {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = new Error(
        `Validation failed: ${error.errors.map(e => e.message).join(', ')}`
      );
      (validationError as any).statusCode = 400;
      (validationError as any).details = error.errors;
      throw validationError;
    }
    throw error;
  }
}
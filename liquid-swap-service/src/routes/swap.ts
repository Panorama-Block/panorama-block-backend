import { Router, Request, Response, NextFunction } from "express";
import { manualSwap } from "../controllers/swapController";

console.log("[Routes] Configuring swap routes");

export const swapRouter = Router();

/**
 * Helper to serialize BigInt to JSON
 * @param obj Object potentially containing BigInt values
 * @returns String JSON representation with BigInt converted to strings
 */
function safeStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  );
}

// Type for async handler wrapper
type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

// Middleware for logging requests
swapRouter.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[Swap Route] ${req.method} ${req.originalUrl}`);
  
  // Log only part of the body to avoid large logs
  const bodyString = safeStringify(req.body);
  const truncatedBody = bodyString.length > 200 
    ? bodyString.substring(0, 200) + "..." 
    : bodyString;
    
  console.log(`[Swap Route] Body: ${truncatedBody}`);
  
  // Monitor response time
  const start = Date.now();
  
  // Intercept response end to log time
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[Swap Route] Response sent with status ${res.statusCode} in ${duration}ms`);
  });
  
  next();
});

/**
 * Middleware that wraps controllers with try-catch for async error handling
 * @param fn Controller function to wrap
 * @returns Wrapped function with error handling
 */
const asyncHandler = (fn: AsyncRequestHandler) => 
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(err => {
      console.error(`[Swap Route] Unhandled error: ${err.message}`);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Internal error in swap processing",
          message: err.message
        });
      }
      next(err);
    });
  };

// Register routes with error handling middleware
console.log("[Routes] Registering manual swap route");
swapRouter.post("/manual", asyncHandler(manualSwap)); 
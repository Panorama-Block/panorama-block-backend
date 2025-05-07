import { Router, Request, Response, NextFunction } from "express";
import { login, verify } from "../controllers/authController";

console.log("[Routes] Configuring authentication routes");

export const authRouter = Router();

// Helper to serialize BigInt to JSON
function safeStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  );
}

// Middleware for logging requests
authRouter.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[Auth Route] ${req.method} ${req.originalUrl}`);
  console.log(`[Auth Route] Body: ${safeStringify(req.body).substring(0, 200)}...`);
  
  // Monitor response time
  const start = Date.now();
  
  // Intercept response end to log time
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[Auth Route] Response sent with status ${res.statusCode} in ${duration}ms`);
  });
  
  next();
});

// Middleware that wraps controllers with try-catch
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(err => {
    console.error(`[Auth Route] Unhandled error: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal error in authentication processing",
        message: err.message
      });
    }
    next(err);
  });
};

// Register routes with error handling middleware
console.log("[Routes] Registering login route");
authRouter.post("/login", asyncHandler(login));

console.log("[Routes] Registering verification route");
authRouter.post("/verify", asyncHandler(verify));

// Keep test routes as fallback for now
console.log("[Routes] Registering test auth route");
authRouter.post("/test", (req: Request, res: Response) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: "Address not provided" });
    }
    
    // Generate a mock payload
    const mockPayload = {
      type: "evm",
      domain: "panoramablock.com",
      address: address,
      statement: "Login to Panorama Block test",
      version: "1",
      chainId: "1",
      nonce: Math.random().toString(36).substring(2, 15),
      issuedAt: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 1000 * 60 * 5).toISOString() // 5 minutes
    };
    
    res.status(200).json({ payload: mockPayload });
  } catch (error: any) {
    console.error("[Auth Test] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Add a simple verify test route
authRouter.post("/test/verify", (req: Request, res: Response) => {
  try {
    const { payload, signature } = req.body;
    
    if (!payload || !signature) {
      return res.status(400).json({ error: "Payload or signature not provided" });
    }
    
    // In a test environment, we accept any signature
    // In production, you'd verify the signature matches the payload
    
    // Generate a mock token
    const token = `mock_jwt_token_${Math.random().toString(36).substring(2, 15)}`;
    
    res.status(200).json({ 
      token, 
      address: payload.address 
    });
  } catch (error: any) {
    console.error("[Auth Test Verify] Error:", error);
    res.status(500).json({ error: error.message });
  }
}); 
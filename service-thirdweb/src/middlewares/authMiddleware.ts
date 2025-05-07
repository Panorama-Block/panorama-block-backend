import { Request, Response, NextFunction } from "express";
import { getAuthInstance } from "../utils/thirdwebAuth";

export interface AuthenticatedRequest extends Request {
  user?: {
    address: string;
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication token not provided" });
    }

    const token = authHeader.split(" ")[1];
    const auth = getAuthInstance();
    
    // Validate the JWT token using ThirdwebAuth
    const payload = await auth.validateToken(token);
    
    // If validation successful, attach user data to request
    req.user = { 
      address: payload.address 
    };
    
    next();
  } catch (err: any) {
    console.error("[authenticate] Error validating token:", err);
    return res.status(401).json({ 
      error: "Invalid or expired token",
      details: err.message
    });
  }
}; 
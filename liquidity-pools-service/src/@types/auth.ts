import { Request } from 'express';

export interface User {
  id: string;
  wallet_address: string;
  email?: string;
  created_at: Date;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}
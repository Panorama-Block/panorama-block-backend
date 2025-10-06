import * as express from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        address: string;
        [key: string]: any;
      };
    }
  }
} 
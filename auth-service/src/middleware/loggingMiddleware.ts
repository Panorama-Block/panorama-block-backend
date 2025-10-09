import { Request, Response, NextFunction } from 'express';

interface LogData {
  timestamp: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  query?: any;
  params?: any;
  ip: string;
  userAgent: string;
  responseStatus?: number;
  responseTime?: number;
  responseBody?: any;
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // Extract request data
  const logData: LogData = {
    timestamp,
    method: req.method,
    url: req.originalUrl || req.url,
    headers: req.headers as Record<string, string>,
    body: req.body,
    query: req.query,
    params: req.params,
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown'
  };

  // Log incoming request
  console.log('\n🚀 [REQUEST INCOMING]', {
    timestamp: logData.timestamp,
    method: logData.method,
    url: logData.url,
    ip: logData.ip,
    userAgent: logData.userAgent,
    headers: {
      'content-type': logData.headers['content-type'],
      'authorization': logData.headers['authorization'] ? '[PRESENT]' : '[NOT PRESENT]',
      'user-agent': logData.userAgent
    },
    body: logData.body,
    query: logData.query,
    params: logData.params,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT || process.env.AUTH_PORT,
      REDIS_HOST: process.env.REDIS_HOST,
      REDIS_PORT: process.env.REDIS_PORT,
      AUTH_DOMAIN: process.env.AUTH_DOMAIN,
      AUTH_PRIVATE_KEY: process.env.AUTH_PRIVATE_KEY ? '[SET]' : '[NOT SET]',
      DEBUG: process.env.DEBUG
    }
  });

  // Override res.json to capture response
  const originalJson = res.json;
  res.json = function(body: any) {
    const responseTime = Date.now() - startTime;
    
    // Log outgoing response
    console.log('\n📤 [RESPONSE OUTGOING]', {
      timestamp: new Date().toISOString(),
      method: logData.method,
      url: logData.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      responseBody: body,
      ip: logData.ip
    });

    console.log('='.repeat(80));
    
    return originalJson.call(this, body);
  };

  // Override res.status to capture status code
  const originalStatus = res.status;
  res.status = function(code: number) {
    const responseTime = Date.now() - startTime;
    
    // Log status change
    console.log(`\n📊 [STATUS CHANGE] ${logData.method} ${logData.url} -> ${code} (${responseTime}ms)`);
    
    return originalStatus.call(this, code);
  };

  next();
};

export const errorLogger = (err: any, req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  
  console.error('\n❌ [ERROR]', {
    timestamp,
    method: req.method,
    url: req.originalUrl || req.url,
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name
    },
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown'
  });
  
  console.log('='.repeat(80));
  
  next(err);
};

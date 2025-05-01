import { Router, Request, Response, NextFunction } from "express";
import { manualSwap } from "../controllers/swapController";

console.log("[Routes] Configurando rotas de swap");

export const swapRouter = Router();

// Helper para serializar BigInt para JSON
function safeStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  );
}

// Middleware para logging de requisições
swapRouter.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[Swap Route] ${req.method} ${req.originalUrl}`);
  console.log(`[Swap Route] Body: ${safeStringify(req.body).substring(0, 200)}...`);
  
  // Monitorar tempo de resposta
  const start = Date.now();
  
  // Interceptar final da resposta para logar o tempo
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[Swap Route] Resposta enviada com status ${res.statusCode} em ${duration}ms`);
  });
  
  next();
});

// Middleware que envolve controllers com try-catch
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(err => {
    console.error(`[Swap Route] Erro não tratado: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Erro interno no processamento do swap",
        message: err.message
      });
    }
    next(err);
  });
};

// Registrar rotas com o middleware de tratamento de erros
console.log("[Routes] Registrando rota de swap manual");
swapRouter.post("/manual", asyncHandler(manualSwap)); 
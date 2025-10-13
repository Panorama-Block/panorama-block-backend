import { Router } from 'express';
import { ValidationMiddleware } from '../middleware/validation';
import { ErrorHandler } from '../middleware/errorHandler';

const router = Router();

// Lazy loading - só instancia quando necessário
let authController: any = null;
const getAuthController = () => {
  if (!authController) {
    const { AuthController } = require('../controllers/AuthController');
    authController = new AuthController();
  }
  return authController;
};

// Authentication routes
router.post('/login', 
  ErrorHandler.asyncWrapper((req, res) => getAuthController().login(req, res))
);

router.post('/refresh', 
  ErrorHandler.asyncWrapper((req, res) => getAuthController().refresh(req, res))
);

router.get('/verify', 
  ErrorHandler.asyncWrapper((req, res) => getAuthController().verify(req, res))
);

router.get('/token-info', 
  ErrorHandler.asyncWrapper((req, res) => getAuthController().tokenInfo(req, res))
);

router.post('/logout', 
  ErrorHandler.asyncWrapper((req, res) => getAuthController().logout(req, res))
);

export { router as AuthRoutes };

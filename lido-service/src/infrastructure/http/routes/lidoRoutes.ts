import { Router } from 'express';
import { ValidationMiddleware } from '../middleware/validation';
import { AuthMiddleware } from '../middleware/auth';
import { ErrorHandler } from '../middleware/errorHandler';

const router = Router();

// Lazy loading - só instancia quando necessário
let lidoController: any = null;
const getLidoController = () => {
  if (!lidoController) {
    const { LidoController } = require('../controllers/LidoController');
    lidoController = new LidoController();
  }
  return lidoController;
};

// Staking operations (require authentication)
router.post('/stake', 
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateStakeRequest,
  ErrorHandler.asyncWrapper((req, res) => getLidoController().stake(req, res))
);

router.post('/unstake', 
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateUnstakeRequest,
  ErrorHandler.asyncWrapper((req, res) => getLidoController().unstake(req, res))
);

router.post('/claim-rewards', 
  AuthMiddleware.authenticate,
  ErrorHandler.asyncWrapper((req, res) => getLidoController().claimRewards(req, res))
);

// Position and history queries (optional authentication)
router.get('/position/:userAddress', 
  AuthMiddleware.optionalAuth,
  ValidationMiddleware.validateUserAddress,
  ErrorHandler.asyncWrapper((req, res) => getLidoController().getPosition(req, res))
);

router.get('/history/:userAddress', 
  AuthMiddleware.optionalAuth,
  ValidationMiddleware.validateUserAddress,
  ErrorHandler.asyncWrapper((req, res) => getLidoController().getStakingHistory(req, res))
);

// Protocol information (public)
router.get('/protocol/info', 
  ErrorHandler.asyncWrapper((req, res) => getLidoController().getProtocolInfo(req, res))
);

// Transaction status (public)
router.get('/transaction/:transactionHash', 
  ValidationMiddleware.validateTransactionHash,
  ErrorHandler.asyncWrapper((req, res) => getLidoController().getTransactionStatus(req, res))
);

export { router as LidoRoutes };

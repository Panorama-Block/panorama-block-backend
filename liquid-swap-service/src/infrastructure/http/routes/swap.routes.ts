
const expressLib = require("express") as any;

import { DIContainer } from "../../di/container";

/**
 * Router real: instanciado a partir do objeto runtime do express.
 * Evita conflitos de tipagem/export com @types/express.
 */
const di = DIContainer.getInstance();
const controller = di.swapController;

// A partir daqui, tipagem deliberadamente afrouxada só para o Router.
const router = expressLib.Router();

// Quote (aceita unit: 'token' | 'wei')
router.post("/quote", controller.getQuote);

// Bundle preparado (approve? + swap) para o FRONT assinar (aceita unit)
router.post("/tx", controller.getPreparedTx);

// (Opcional) Mantido para compat; retorna 501 no V1 non-custodial
router.post("/execute", controller.executeSwap);

// Histórico do usuário autenticado
router.get("/history", controller.getSwapHistory);

// Status de uma transação
router.get("/status/:transactionHash", controller.getStatus);

export { router as swapRouter };

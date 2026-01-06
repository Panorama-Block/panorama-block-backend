const expressLib = require("express") as any;

import { DIContainer } from "../../di/container";

/**
 * Admin Routes
 * Protected routes for managing protocol configuration
 */

const di = DIContainer.getInstance();
const protocolFeeController = di.protocolFeeController;

const router = expressLib.Router();

// Get protocol fee configuration
// GET /admin/fees
// GET /admin/fees?provider=uniswap
router.get("/fees", protocolFeeController.getFees);

// Set protocol fee (admin only)
// PUT /admin/fees
router.put("/fees", protocolFeeController.setFee);

export { router as adminRouter };

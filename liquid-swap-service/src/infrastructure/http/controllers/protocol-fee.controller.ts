import type {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express-serve-static-core";

import { GetProtocolFeeUseCase } from "../../../application/usecases/get.protocol-fee.usecase";
import { SetProtocolFeeUseCase } from "../../../application/usecases/set.protocol-fee.usecase";
import {
  createMissingParamsError,
  createUnauthorizedError,
} from "../../../domain/entities/errors";

// Alias dos tipos base
type Request = ExpressRequest;
type Response = ExpressResponse;

// Tipagem local para acessar req.user (endereço do usuário autenticado)
type RequestWithUser = Request & {
  user?: { address: string; [k: string]: any };
};

export class ProtocolFeeController {
  constructor(
    private readonly getProtocolFeeUseCase: GetProtocolFeeUseCase,
    private readonly setProtocolFeeUseCase: SetProtocolFeeUseCase
  ) {}

  /**
   * GET /admin/fees
   * Get current protocol fee configuration
   */
  public getFees = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      console.log("[ProtocolFeeController] Getting protocol fees");

      const { provider } = req.query as { provider?: string };

      const result = await this.getProtocolFeeUseCase.execute({ provider });

      return res.json({
        success: true,
        data: result.fees,
      });
    } catch (error) {
      console.error("[ProtocolFeeController] Error getting fees:", error);
      return next(error);
    }
  };

  /**
   * PUT /admin/fees
   * Set protocol fee for a provider (admin only)
   */
  public setFee = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      console.log("[ProtocolFeeController] Setting protocol fee");

      const aReq = req as RequestWithUser;
      // TODO: re-enable auth check in production
      // if (!aReq.user?.address) {
      //   return next(createUnauthorizedError("Admin authentication required"));
      // }

      const { provider, taxInPercent, taxInBips, taxInEth, isActive } =
        req.body as {
          provider?: string;
          taxInPercent?: number;
          taxInBips?: number;
          taxInEth?: string;
          isActive?: boolean;
        };

      if (!provider || taxInPercent === undefined) {
        return next(createMissingParamsError(["provider", "taxInPercent"]));
      }

      const result = await this.setProtocolFeeUseCase.execute({
        provider,
        taxInPercent,
        taxInBips,
        taxInEth,
        isActive,
        adminAddress: aReq.user?.address || "dev-admin",
      });

      return res.json({
        success: result.success,
        data: {
          provider: result.provider,
          taxInPercent: result.taxInPercent,
          isActive: result.isActive,
        },
        message: result.message,
      });
    } catch (error) {
      console.error("[ProtocolFeeController] Error setting fee:", error);
      return next(error);
    }
  };
}

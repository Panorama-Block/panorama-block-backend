import { Request, Response } from "express";
import { ThirdwebAuth } from "@thirdweb-dev/auth";
import { PrivateKeyWallet } from "@thirdweb-dev/auth/evm";

console.log("[authController] Initializing authentication controller");

// Carrega config
const domain = process.env.AUTH_DOMAIN || "panoramablock.com";
const privateKey = process.env.AUTH_PRIVATE_KEY || "";

if (!privateKey) {
  console.warn("[authController] WARNING: AUTH_PRIVATE_KEY not configured");
}
if (!domain) {
  console.warn("[authController] WARNING: AUTH_DOMAIN not configured");
}

// Cria instância
const wallet = new PrivateKeyWallet(privateKey);
const auth = new ThirdwebAuth(wallet, domain);
console.log("[authController] ThirdwebAuth instance created");

// --- INSPEÇÃO: lista métodos disponíveis para sabermos chamar cada um corretamente ---
console.log(
  "[authController] Auth prototype methods:",
  Object.getOwnPropertyNames(Object.getPrototypeOf(auth))
);
console.log("[authController] Auth own properties:", Object.keys(auth));
// ----------------------------------------------------------------------

/**
 * POST /auth/login
 * Body: { address }
 */
export const login = async (req: Request, res: Response) => {
  console.log("[authController] login called");
  try {
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({ error: "Address not provided" });
    }

    // TENTATIVA genérica: chame o método que existir (login, generateLoginPayload, getLoginPayload)
    let payload;
    if (typeof (auth as any).generateLoginPayload === "function") {
      payload = await (auth as any).generateLoginPayload({ address });
    } else if (typeof (auth as any).getLoginPayload === "function") {
      payload = await (auth as any).getLoginPayload({ address });
    } else if (typeof (auth as any).login === "function") {
      payload = await (auth as any).login({ address });
    } else {
      throw new Error("Nenhum método de gerar payload encontrado em auth");
    }

    return res.json({ payload });
  } catch (err: any) {
    console.error("[authController] login error:", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * POST /auth/verify
 * Body: { payload, signature }
 */
export const verify = async (req: Request, res: Response) => {
  console.log("[authController] verify called");
  try {
    const { payload, signature } = req.body;
    if (!payload || !signature) {
      return res
        .status(400)
        .json({ error: "Payload or signature not provided" });
    }

    // TENTATIVA genérica de verificação
    let address;
    if (typeof (auth as any).verifyLogin === "function") {
      address = await (auth as any).verifyLogin({ payload, signature });
    } else if (typeof (auth as any).verify === "function") {
      address = await (auth as any).verify({ payload, signature });
    } else {
      throw new Error("Nenhum método de verificação encontrado em auth");
    }

    // TENTATIVA genérica de gerar token
    let token;
    if (typeof (auth as any).generateAuthToken === "function") {
      token = await (auth as any).generateAuthToken({ address });
    } else if (typeof (auth as any).getAuthToken === "function") {
      token = await (auth as any).getAuthToken({ address });
    } else if (typeof (auth as any).login === "function") {
      // alguns SDKs unificam login+token
      const result = await (auth as any).login({ address });
      token = result?.token || result?.authToken;
    } else {
      throw new Error("Nenhum método de gerar token encontrado em auth");
    }

    return res.json({ token, address });
  } catch (err: any) {
    console.error("[authController] verify error:", err);
    return res.status(401).json({ error: err.message });
  }
};

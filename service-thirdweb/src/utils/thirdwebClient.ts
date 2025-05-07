// src/utils/thirdwebClient.ts

import { createThirdwebClient } from "thirdweb";
import { ethers } from "ethers";

/**
 * Observações:
 *  - Use variáveis do seu .env para RPC_URL, PRIVATE_KEY, THIRDWEB_CLIENT_ID etc.
 *  - Se preferir, você pode ler as envs diretamente aqui ou passar via construtor.
 */
const RPC_URL =
  process.env.RPC_URL || "https://eth-goerli.g.alchemy.com/v2/xxxxx";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const CLIENT_ID = process.env.THIRDWEB_CLIENT_ID || "";
const AUTH_PRIVATE_KEY = process.env.AUTH_PRIVATE_KEY || "";

console.log("[thirdwebClient] Inicializando cliente Thirdweb...");

let thirdwebSdk: ReturnType<typeof createThirdwebClient>;

try {
  if (!RPC_URL || !PRIVATE_KEY || !CLIENT_ID || !AUTH_PRIVATE_KEY) {
    console.warn(
      "[Aviso] Faltam variáveis de ambiente para Thirdweb: RPC_URL, PRIVATE_KEY ou THIRDWEB_CLIENT_ID."
    );
  }

  // 1) Criamos um provider e signer (custodial)
  console.log("[thirdwebClient] Configurando provider com RPC:", RPC_URL.substring(0, 20) + "...");
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  
  console.log("[thirdwebClient] Configurando wallet signer...");
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log("[thirdwebClient] Signer configurado com endereço:", signer.address);

  // 2) Instanciamos ThirdwebSDK com clientId
  console.log("[thirdwebClient] Criando instância do Thirdweb client...");
  thirdwebSdk = createThirdwebClient({
    clientId: CLIENT_ID,
    secretKey: AUTH_PRIVATE_KEY
  });
  
  console.log("[thirdwebClient] Cliente Thirdweb inicializado com sucesso");
} catch (error) {
  console.error("[thirdwebClient] Erro ao inicializar cliente Thirdweb:", error);
  throw new Error(`Falha ao inicializar Thirdweb: ${error instanceof Error ? error.message : String(error)}`);
}

export { thirdwebSdk };


import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { ChainId } from "@thirdweb-dev/sdk";
import {
  Ethereum,
  Polygon,
  BinanceSmartChain,
  Arbitrum,
  Optimism,
  Base,
} from "@thirdweb-dev/chains";
import { ethers } from "ethers";

// List of chains supported by o serviço
const SUPPORTED_CHAINS = [
  Ethereum,
  Polygon,
  BinanceSmartChain,
  Arbitrum,
  Optimism,
  Base,
];

// Helper to build config options for the SDK
function buildSdkOptions() {
  const secretKey = process.env.THIRDWEB_SECRET_KEY || "";
  const clientId = process.env.THIRDWEB_CLIENT_ID || "";

  if (!secretKey) {
    console.error(
      "[ThirdwebClient] Missing THIRDWEB_SECRET_KEY. Create one at https://thirdweb.com/dashboard/api-keys and set it in the environment variables."
    );
  }

  return {
    secretKey, // obrigatório para uso backend
    clientId,  // opcional: permite rate-limit melhor no RPC público
    supportedChains: SUPPORTED_CHAINS,
  } as any; // cast para evitar types drift entre versões
}

console.log("[ThirdwebClient] Initializing ThirdwebSDK client");

export const thirdwebSdk = new ThirdwebSDK(Ethereum.chainId, buildSdkOptions());

console.log("[ThirdwebClient] ThirdwebSDK initialized");

export const createSDKForChain = (chainId: ChainId): ThirdwebSDK => {
  return new ThirdwebSDK(chainId, buildSdkOptions());
};

export const SUPPORTED_CHAINS = {
  ethereum: Ethereum.chainId,
  polygon: Polygon.chainId,
  bsc: BinanceSmartChain.chainId,
  arbitrum: Arbitrum.chainId,
  optimism: Optimism.chainId,
  base: Base.chainId,
};

export const isSdkInitialized = (): boolean => {
  return thirdwebSdk !== undefined;
};


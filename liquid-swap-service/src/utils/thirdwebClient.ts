import { ThirdwebSDK } from "@thirdweb-dev/sdk";

// Create a client for SDK initialization
console.log("[ThirdwebClient] Initializing ThirdwebSDK client");

// Inicializar o SDK com o provider apropriado
// Como trabalhamos com diferentes chains, não especificamos um aqui
// Usamos any para contornar problemas de tipagem
export const thirdwebSdk = new (ThirdwebSDK as any)(undefined, {
  clientId: process.env.THIRDWEB_CLIENT_ID || "",
});

console.log("[ThirdwebClient] ThirdwebSDK initialized");

// Utility function to check if SDK is initialized
export const isSdkInitialized = (): boolean => {
  return thirdwebSdk !== undefined;
};

// Export any additional utility functions needed for working with ThirdWeb 
import { createThirdwebClient } from "thirdweb";

/**
 * ThirdWeb Client Configuration
 * Based on the working implementation from service-thirdweb
 */

const CLIENT_ID = process.env.THIRDWEB_CLIENT_ID || "";
const SECRET_KEY = process.env.THIRDWEB_SECRET_KEY || "";

console.log("[thirdwebClient] Initializing ThirdWeb client...");

let thirdwebSdk: ReturnType<typeof createThirdwebClient>;

try {
  if (!CLIENT_ID) {
    console.warn("[Warning] Missing THIRDWEB_CLIENT_ID environment variable");
    throw new Error("THIRDWEB_CLIENT_ID is required");
  }

  // Create ThirdWeb client with clientId and optional secretKey
  console.log("[thirdwebClient] Creating ThirdWeb client instance...");
  thirdwebSdk = createThirdwebClient({
    clientId: CLIENT_ID,
    ...(SECRET_KEY && { secretKey: SECRET_KEY })
  });
  
  console.log("[thirdwebClient] ThirdWeb client initialized successfully");
} catch (error) {
  console.error("[thirdwebClient] Error initializing ThirdWeb client:", error);
  throw new Error(`Failed to initialize ThirdWeb: ${error instanceof Error ? error.message : String(error)}`);
}

export { thirdwebSdk };


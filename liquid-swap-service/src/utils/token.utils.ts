import { NATIVE_TOKEN_ADDRESS } from "thirdweb";
import { resolveToken, getNativeMetadata } from "../config/tokens/registry";

const decimalsCache = new Map<string, number>(); // key: `${chainId}:${address}`

export async function getTokenDecimals(
  chainId: number,
  tokenAddressOrNative: string
): Promise<number> {
  // Check if native token
  const normalized = tokenAddressOrNative.toLowerCase();
  if (normalized === "native" || normalized === NATIVE_TOKEN_ADDRESS.toLowerCase()) {
    const nativeMeta = getNativeMetadata(chainId);
    return nativeMeta.decimals;
  }

  // Check cache
  const key = `${chainId}:${normalized}`;
  const cached = decimalsCache.get(key);
  if (cached !== undefined) return cached;

  // Try to resolve from registry
  try {
    // Try 'uniswap' first (covers both Trading API and Smart Router tokens)
    try {
      const token = resolveToken('uniswap', chainId, tokenAddressOrNative);
      const decimals = token.metadata.decimals;
      decimalsCache.set(key, decimals);
      return decimals;
    } catch {
      // Try thirdweb as fallback
      try {
        const token = resolveToken('thirdweb', chainId, tokenAddressOrNative);
        const decimals = token.metadata.decimals;
        decimalsCache.set(key, decimals);
        return decimals;
      } catch {
        // If not found in registry, default to 18 (standard ERC20)
        console.warn(`[token.utils] Token ${tokenAddressOrNative} not found in registry for chain ${chainId}, defaulting to 18 decimals`);
        decimalsCache.set(key, 18);
        return 18;
      }
    }
  } catch (error) {
    console.error(`[token.utils] Error getting token decimals:`, error);
    // Default to 18 decimals for ERC20 tokens
    decimalsCache.set(key, 18);
    return 18;
  }
}

export function toWei(amountHuman: string, decimals: number): bigint {
  // conversão segura sem ethers: trata string decimal e multiplica por 10^decimals
  const [intPart, fracPartRaw = ""] = amountHuman.split(".");
  const fracPart = fracPartRaw.padEnd(decimals, "0").slice(0, decimals);
  const normalized = (intPart || "0") + (fracPart ? fracPart : "");
  const digits = normalized.replace(/^0+/, "");
  return BigInt(digits === "" ? "0" : digits);
}

export function fromWei(amountWei: bigint, decimals: number): string {
  const s = amountWei.toString();
  if (decimals === 0) return s;
  const padded = s.padStart(decimals + 1, "0");
  const intPart = padded.slice(0, -decimals);
  const frac = padded.slice(-decimals).replace(/0+$/, "");
  return frac.length ? `${intPart}.${frac}` : intPart;
}



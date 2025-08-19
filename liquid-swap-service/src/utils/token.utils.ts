import { Bridge, NATIVE_TOKEN_ADDRESS } from "thirdweb";
import { thirdwebSdk } from "./thirdwebClient";

const decimalsCache = new Map<string, number>(); // key: `${chainId}:${address}`

export async function getTokenDecimals(
  chainId: number,
  tokenAddressOrNative: string
): Promise<number> {
  if (tokenAddressOrNative.toLowerCase() === "native") return 18;
  const key = `${chainId}:${tokenAddressOrNative.toLowerCase()}`;
  const cached = decimalsCache.get(key);
  if (cached !== undefined) return cached;
  const tokenAddr = tokenAddressOrNative.toLowerCase() === 'native' ? NATIVE_TOKEN_ADDRESS : tokenAddressOrNative;
  const tokens = await Bridge.tokens({ client: thirdwebSdk, chainId, tokenAddress: tokenAddr });
  const dec = tokens?.[0]?.decimals ?? 18;
  decimalsCache.set(key, dec);
  return dec;
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



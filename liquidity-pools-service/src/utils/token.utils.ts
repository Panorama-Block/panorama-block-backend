// Mock implementation for MVP - in production, integrate with proper token service

const decimalsCache = new Map<string, number>(); // key: `${chainId}:${address}`

export async function getTokenDecimals(
  chainId: number,
  tokenAddressOrNative: string
): Promise<number> {
  if (tokenAddressOrNative.toLowerCase() === "native") return 18;

  const key = `${chainId}:${tokenAddressOrNative.toLowerCase()}`;
  const cached = decimalsCache.get(key);
  if (cached !== undefined) return cached;

  // Mock common token decimals for MVP
  const mockDecimals = getMockTokenDecimals(tokenAddressOrNative.toLowerCase());
  decimalsCache.set(key, mockDecimals);
  return mockDecimals;
}

function getMockTokenDecimals(address: string): number {
  // Common token decimals mapping for MVP
  const commonTokens: { [key: string]: number } = {
    '0xa0b86a33e6441c5ad2d8b96ee1a1aa6e7c77fe6b': 6,  // USDC
    '0xdac17f958d2ee523a2206206994597c13d831ec7': 6,  // USDT
    '0x6b175474e89094c44da98b954eedeac495271d0f': 18, // DAI
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 18, // WETH
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 8,  // WBTC
  };

  return commonTokens[address] || 18; // Default to 18 decimals
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



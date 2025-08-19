import { createThirdwebClient, Bridge, NATIVE_TOKEN_ADDRESS } from "thirdweb";
import { ethereum } from "thirdweb/chains";

const client = createThirdwebClient({
  clientId: process.env.THIRDWEB_CLIENT_ID || "",
  secretKey: process.env.THIRDWEB_SECRET_KEY || undefined,
});

type CacheEntry = { v: number; at: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 20_000;

export async function getTokenSpotUsdPrice(chainId: number, token: string): Promise<number | null> {
  const key = `spot:${chainId}:${token.toLowerCase()}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.v;

  const tkn = token.toLowerCase() === 'native' ? NATIVE_TOKEN_ADDRESS : token;
  try {
    const tokens = await Bridge.tokens({ client, chainId, tokenAddress: tkn });
    const first = tokens?.[0];
    const usd = first?.priceUsd;
    if (typeof usd === 'number' && usd > 0) {
      cache.set(key, { v: usd, at: now });
      return usd;
    }
  } catch {}
  return null;
}

export async function convertCryptoToUsd(chainId: number, token: string, amountHuman: number): Promise<number | null> {
  const tkn = token.toLowerCase() === 'native' ? NATIVE_TOKEN_ADDRESS : token as `0x${string}`;
  try {
    const { result } = await (await import("thirdweb/pay")).convertCryptoToFiat({
      client,
      chain: { id: chainId } as any,
      fromTokenAddress: tkn,
      fromAmount: amountHuman,
      to: "USD",
    });
    return typeof result === 'number' ? result : null;
  } catch {
    return null;
  }
}



export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const ETH_SENTINEL = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

export function isNativeLike(addr?: string): boolean {
  if (!addr) return false;
  const a = addr.toLowerCase();
  return a === "native" || a === ZERO_ADDRESS || a === ETH_SENTINEL;
}

export function normalizeToNative(addr: string): string {
  return isNativeLike(addr) ? "native" : addr;
}


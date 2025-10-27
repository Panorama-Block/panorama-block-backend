import fs from "fs";
import path from "path";
import { isNativeLike } from "../../utils/native.utils";

export type LiquidityProvider = "uniswap" | "thirdweb";

export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  icon?: string;
  providers: LiquidityProvider[];
}

export interface ResolvedToken {
  identifier: string;
  isNative: boolean;
  metadata: TokenMetadata;
}

type RegistryData = {
  chains: Record<
    string,
    {
      name: string;
      explorer?: string;
      native: {
        symbol: string;
        name: string;
        decimals: number;
        icon?: string;
        identifiers?: Record<LiquidityProvider, string>;
        wrapped?: {
          address: string;
          symbol: string;
          name: string;
        };
      };
      tokens: Array<{
        address: string;
        symbol: string;
        name: string;
        decimals: number;
        providers: LiquidityProvider[];
        icon?: string;
      }>;
    }
  >;
};

function loadTokenRegistry(): RegistryData {
  const candidatePaths = [
    process.env.TOKEN_REGISTRY_PATH,
    path.resolve(process.cwd(), "shared/token-registry.json"),
    path.resolve(process.cwd(), "../shared/token-registry.json"),
    path.resolve(process.cwd(), "panorama-block-backend/shared/token-registry.json"),
    path.resolve(__dirname, "../../../../shared/token-registry.json"),
    path.resolve(__dirname, "../../../../../shared/token-registry.json"),
  ].filter((p): p is string => Boolean(p));

  for (const filePath of candidatePaths) {
    if (fs.existsSync(filePath)) {
      const fileContents = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(fileContents) as RegistryData;
    }
  }

  throw new Error(
    `Token registry file not found. Checked paths: ${candidatePaths.join(", ")}`
  );
}

type ChainRegistry = RegistryData["chains"][string];

const chainMap = new Map<number, ChainRegistry>();
const providerTokenMaps: Record<LiquidityProvider, Map<number, Map<string, TokenMetadata>>> = {
  uniswap: new Map(),
  thirdweb: new Map(),
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

let registryInitialized = false;

function ensureRegistryInitialized(): void {
  if (registryInitialized) {
    return;
  }

  const registry = loadTokenRegistry();

  chainMap.clear();
  Object.values(providerTokenMaps).forEach((providerMap) => providerMap.clear());

  Object.entries(registry.chains).forEach(([chainIdRaw, chainData]) => {
    const chainId = Number(chainIdRaw);
    chainMap.set(chainId, chainData);

    const tokenEntries = chainData.tokens ?? [];
    tokenEntries.forEach((token) => {
      const addressLc = token.address.toLowerCase();
      (token.providers as LiquidityProvider[]).forEach((provider) => {
        const providerMap = providerTokenMaps[provider];
        if (!providerMap.has(chainId)) {
          providerMap.set(chainId, new Map());
        }
        providerMap.get(chainId)!.set(addressLc, {
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          icon: token.icon,
          providers: token.providers,
        });
      });
    });
  });

  registryInitialized = true;
}

function getChainConfig(chainId: number): ChainRegistry {
  ensureRegistryInitialized();
  const chain = chainMap.get(chainId);
  if (!chain) {
    throw new Error(`Unsupported chain ${chainId}`);
  }
  return chain;
}

function formatSupportedTokens(provider: LiquidityProvider, chainId: number): string {
  const tokens = listSupportedTokens(provider, chainId);
  if (!tokens.length) {
    return "(none)";
  }
  return tokens.map((t) => `${t.symbol}`).join(", ");
}

export function listSupportedChainsForProvider(provider: LiquidityProvider): number[] {
  ensureRegistryInitialized();
  return Array.from(providerTokenMaps[provider].keys());
}

export function listSupportedTokens(provider: LiquidityProvider, chainId: number): TokenMetadata[] {
  ensureRegistryInitialized();
  const map = providerTokenMaps[provider].get(chainId);
  if (!map) return [];
  return Array.from(map.values());
}

export function isTokenSupported(provider: LiquidityProvider, chainId: number, token: string): boolean {
  try {
    resolveToken(provider, chainId, token);
    return true;
  } catch {
    return false;
  }
}

export function resolveToken(
  provider: LiquidityProvider,
  chainId: number,
  token: string
): ResolvedToken {
  const chain = getChainConfig(chainId);
  const identifiers = (chain.native.identifiers ?? {}) as Record<LiquidityProvider, string | undefined>;
  const providerIdentifier = identifiers[provider];
  if (!providerIdentifier) {
    throw new Error(`Provider ${provider} is not configured for chain ${chainId}`);
  }

  const normalizedInput = token.toLowerCase();
  const normalizedIdentifier = providerIdentifier.toLowerCase();

  if (isNativeLike(token) || normalizedInput === normalizedIdentifier) {
    const nativeProviders = Object.keys(chain.native.identifiers ?? {}) as LiquidityProvider[];
    const metadata: TokenMetadata = {
      address:
        chain.native.wrapped?.address ||
        chain.native.identifiers?.uniswap ||
        chain.native.identifiers?.thirdweb ||
        ZERO_ADDRESS,
      symbol: chain.native.symbol,
      name: chain.native.name,
      decimals: chain.native.decimals,
      icon: chain.native.icon,
      providers: nativeProviders,
    };
    return {
      identifier: providerIdentifier,
      isNative: true,
      metadata,
    };
  }

  const providerTokens = providerTokenMaps[provider].get(chainId);
  if (!providerTokens) {
    throw new Error(`Provider ${provider} has no tokens configured for chain ${chainId}`);
  }

  const direct = providerTokens.get(normalizedInput);
  if (direct) {
    return {
      identifier: direct.address,
      isNative: false,
      metadata: direct,
    };
  }

  const symbolMatch = Array.from(providerTokens.values()).find(
    (entry) => entry.symbol.toLowerCase() === normalizedInput
  );
  if (symbolMatch) {
    return {
      identifier: symbolMatch.address,
      isNative: false,
      metadata: symbolMatch,
    };
  }

  throw new Error(
    `Token ${token} is not supported for provider ${provider} on chain ${chainId}. Supported tokens: ${formatSupportedTokens(
      provider,
      chainId
    )}`
  );
}

export function getNativeMetadata(chainId: number): TokenMetadata {
  const chain = getChainConfig(chainId);
  const wrapped = chain.native.wrapped;
  const identifiers = (chain.native.identifiers ?? {}) as Record<LiquidityProvider, string | undefined>;
  const providerList = Object.keys(identifiers) as LiquidityProvider[];
  return {
    address:
      wrapped?.address ||
      identifiers.uniswap ||
      identifiers.thirdweb ||
      ZERO_ADDRESS,
    symbol: chain.native.symbol,
    name: chain.native.name,
    decimals: chain.native.decimals,
    icon: chain.native.icon,
    providers: providerList,
  };
}

export function getNativeWrappedToken(chainId: number): {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
} {
  const chain = getChainConfig(chainId);
  const wrapped = chain.native.wrapped;
  const symbol = wrapped?.symbol ?? `W${chain.native.symbol}`;
  const name = wrapped?.name ?? `Wrapped ${chain.native.name}`;
  const address = wrapped?.address || chain.native.identifiers?.uniswap || ZERO_ADDRESS;
  return {
    address,
    symbol,
    name,
    decimals: chain.native.decimals,
  };
}

export function providerHasChain(provider: LiquidityProvider, chainId: number): boolean {
  ensureRegistryInitialized();
  return providerTokenMaps[provider].has(chainId);
}

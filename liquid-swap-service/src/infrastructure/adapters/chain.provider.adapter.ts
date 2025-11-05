import { IChainProvider } from "../../domain/ports/swap.repository";
import { ethers } from "ethers";

export class ChainProviderAdapter implements IChainProvider {
  private readonly supportedChains = [1, 137, 56, 8453, 10, 42161, 43114];
  private readonly providers: { [chainId: number]: ethers.providers.StaticJsonRpcProvider } = {};

  constructor() {
    this.initializeProviders();
    console.log("[ChainProviderAdapter] Initialized for chains:", this.supportedChains);
  }

  private initializeProviders(): void {
    for (const chainId of this.supportedChains) {
      const rpcUrl = this.getRpcUrl(chainId);
      const network = { name: `chain-${chainId}`, chainId };
      const provider = new ethers.providers.StaticJsonRpcProvider(
        {
          url: rpcUrl,
          skipFetchSetup: true,
        },
        network
      );
      this.providers[chainId] = provider;
    }
  }

  public getProvider(chainId: number): any {
    if (!this.isChainSupported(chainId)) {
      throw new Error(`Chain ${chainId} is not supported`);
    }
    return this.providers[chainId];
  }

  public getSigner(_chainId: number): never {
    throw new Error("Signer access is disabled in non-custodial mode");
  }

  public getRpcUrl(chainId: number): string {
    const chainRpcMap: { [key: number]: string } = {
      1: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
      137: process.env.POLYGON_RPC_URL || "https://polygon.llamarpc.com",
      56: process.env.BSC_RPC_URL || "https://bsc.llamarpc.com",
      8453: process.env.BASE_RPC_URL || "https://base.llamarpc.com",
      10: process.env.OPTIMISM_RPC_URL || "https://optimism.llamarpc.com",
      42161: process.env.ARBITRUM_RPC_URL || "https://arbitrum.llamarpc.com",
      43114: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
    };

    const rpcUrl = chainRpcMap[chainId];
    if (!rpcUrl) {
      throw new Error(`No RPC URL configured for chain ${chainId}`);
    }

    return rpcUrl;
  }

  public isChainSupported(chainId: number): boolean {
    return this.supportedChains.includes(chainId);
  }
} 

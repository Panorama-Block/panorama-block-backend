// Infrastructure Adapters
import { createThirdwebClient, Bridge, NATIVE_TOKEN_ADDRESS } from "thirdweb";
import { ethers } from "ethers";
import { SwapRequest, SwapQuote, SwapResult, SwapTransaction, TransactionStatus } from "../../domain/entities/swap";
import { ISwapService } from "../../domain/ports/swap.repository";

export class ThirdwebSwapAdapter implements ISwapService {
  private client: any;

  constructor() {
    // Get ThirdWeb credentials
    const clientId = process.env.THIRDWEB_CLIENT_ID;
    const secretKey = process.env.THIRDWEB_SECRET_KEY;

    console.log("[ThirdwebSwapAdapter] Initializing with credentials:");
    console.log("- CLIENT_ID:", clientId ? `${clientId.substring(0, 8)}...` : "[NOT SET]");
    console.log("- SECRET_KEY:", secretKey ? `${secretKey.substring(0, 8)}...` : "[NOT SET]");

    if (!clientId) {
      throw new Error("THIRDWEB_CLIENT_ID is required");
    }

    // Initialize ThirdWeb client with clientId and secretKey
    this.client = createThirdwebClient({
      clientId: clientId,
      secretKey: secretKey // Include secretKey for authentication
    });

    console.log("[ThirdwebSwapAdapter] Initialized successfully");
  }

  public async getQuote(swapRequest: SwapRequest): Promise<SwapQuote> {
    try {
      console.log("[ThirdwebSwapAdapter] Getting quote for:", swapRequest.toLogString());
      
      const sellAmountWei = swapRequest.amount;
      
      const quote = await Bridge.Sell.quote({
        originChainId: swapRequest.fromChainId,
        originTokenAddress: swapRequest.fromToken === 'native' 
          ? NATIVE_TOKEN_ADDRESS 
          : swapRequest.fromToken,
        destinationChainId: swapRequest.toChainId,
        destinationTokenAddress: swapRequest.toToken,
        amount: sellAmountWei,
        client: this.client,
      });

      console.log("[ThirdwebSwapAdapter] Quote received:", {
        destinationAmount: quote.destinationAmount.toString(),
        originAmount: quote.originAmount.toString(),
        estimatedTime: quote.estimatedExecutionTimeMs
      });

      return new SwapQuote(
        BigInt(quote.destinationAmount.toString()),
        BigInt(quote.originAmount.toString()) - BigInt(quote.destinationAmount.toString()),
        BigInt("420000000000000"), // Estimated gas fee
        0.998, // Exchange rate
        Math.floor((quote.estimatedExecutionTimeMs || 60000) / 1000) // Duration in seconds
      );
    } catch (error: any) {
      console.error("[ThirdwebSwapAdapter] Error getting quote:", error);
      throw new Error(`Failed to get quote: ${error.message}`);
    }
  }

  public async prepareSwap(swapRequest: SwapRequest): Promise<any> {
    try {
      const sellAmountWei = swapRequest.amount;
      
      const prepared = await Bridge.Sell.prepare({
        originChainId: swapRequest.fromChainId,
        originTokenAddress: swapRequest.fromToken === 'native' 
          ? NATIVE_TOKEN_ADDRESS 
          : swapRequest.fromToken,
        destinationChainId: swapRequest.toChainId,
        destinationTokenAddress: swapRequest.toToken,
        amount: sellAmountWei,
        sender: swapRequest.sender,
        receiver: swapRequest.receiver,
        client: this.client,
      });

      return prepared;
    } catch (error: any) {
      throw new Error(`Failed to prepare swap: ${error.message}`);
    }
  }

  public async executeSwap(swapRequest: SwapRequest): Promise<SwapResult> {
    try {
      // First prepare the swap
      const prepared = await this.prepareSwap(swapRequest);
      const quote = await this.getQuote(swapRequest);
      
      // Create transactions based on prepared data
      const transactions: SwapTransaction[] = [];
      
      for (const step of prepared.steps) {
        for (const transaction of step.transactions) {
          const swapTransaction = new SwapTransaction(
            '', // Hash will be set after execution
            transaction.chainId || swapRequest.fromChainId,
            transaction.to || '',
            transaction.data || '0x',
            BigInt(transaction.value?.toString() || '0')
          );
          
          // Simulate transaction execution (in real implementation, use sendTransaction)
          swapTransaction.updateStatus(TransactionStatus.PENDING);
          
          // Mock transaction hash
          const mockHash = `0x${Math.random().toString(16).substr(2, 64)}`;
          
          // In real implementation, you would send the transaction here:
          // const result = await sendTransaction({
          //   transaction: {
          //     to: transaction.to,
          //     data: transaction.data,
          //     value: BigInt(transaction.value),
          //     gas: BigInt(transaction.gasLimit),
          //   },
          //   account: userWallet.account,
          // });
          
          // Simulate confirmation
          await new Promise(resolve => setTimeout(resolve, 1000));
          swapTransaction.updateStatus(TransactionStatus.CONFIRMED);
          
          // Simulate completion
          await new Promise(resolve => setTimeout(resolve, 1000));
          swapTransaction.updateStatus(TransactionStatus.COMPLETED);
          
          transactions.push(swapTransaction);
        }
      }

      const result = new SwapResult(transactions, quote);
      result.complete();
      
      return result;

    } catch (error: any) {
      console.error("[ThirdwebSwapAdapter] Error executing swap:", error);
      
      // Create failed result
      const quote = new SwapQuote(BigInt(0), BigInt(0), BigInt(0), 0, 0);
      const transactions: SwapTransaction[] = [];
      const result = new SwapResult(transactions, quote);
      
      throw new Error(`Failed to execute swap: ${error.message}`);
    }
  }

  public async monitorTransaction(transactionHash: string, chainId: number): Promise<string> {
    try {
      const status = await Bridge.status({
        transactionHash: transactionHash as `0x${string}`,
        chainId: chainId,
        client: this.client,
      });

      switch (status.status) {
        case 'COMPLETED':
          return TransactionStatus.COMPLETED;
        case 'PENDING':
          return TransactionStatus.PENDING;
        case 'FAILED':
          return TransactionStatus.FAILED;
        default:
          return TransactionStatus.PENDING;
      }
    } catch (error: any) {
      throw new Error(`Failed to monitor transaction: ${error.message}`);
    }
  }

  public async getSupportedChains(): Promise<any[]> {
    try {
      // Real implementation would call Bridge.chains() or similar
      const supportedChains = [
        { chainId: 1, name: 'Ethereum', icon: '', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } },
        { chainId: 137, name: 'Polygon', icon: '', nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 } },
        { chainId: 56, name: 'BSC', icon: '', nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 } },
        { chainId: 8453, name: 'Base', icon: '', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } },
        { chainId: 10, name: 'Optimism', icon: '', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } },
        { chainId: 42161, name: 'Arbitrum', icon: '', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } },
        { chainId: 43114, name: 'Avalanche', icon: '', nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 } }
      ];

      console.log(`[ThirdwebSwapAdapter] Returning ${supportedChains.length} supported chains`);
      return supportedChains;
    } catch (error: any) {
      console.error("[ThirdwebSwapAdapter] Error getting supported chains:", error);
      throw new Error(`Failed to get supported chains: ${error.message}`);
    }
  }

  public async getSupportedRoutes(originChainId?: number, destinationChainId?: number): Promise<any[]> {
    try {
      // Note: Implementation using actual ThirdWeb Bridge API would go here
      // For now, we'll return mock supported routes
      
      const mockRoutes = [
        {
          originToken: { chainId: 1, address: 'native', symbol: 'ETH', name: 'Ethereum', decimals: 18 },
          destinationToken: { chainId: 137, address: 'native', symbol: 'MATIC', name: 'Polygon', decimals: 18 }
        },
        {
          originToken: { chainId: 137, address: 'native', symbol: 'MATIC', name: 'Polygon', decimals: 18 },
          destinationToken: { chainId: 1, address: 'native', symbol: 'ETH', name: 'Ethereum', decimals: 18 }
        }
      ];

      console.log(`[ThirdwebSwapAdapter] Returning ${mockRoutes.length} supported routes`);
      return mockRoutes;
    } catch (error: any) {
      console.error("[ThirdwebSwapAdapter] Error getting supported routes:", error);
      throw new Error(`Failed to get supported routes: ${error.message}`);
    }
  }

  private getChainRpcUrl(chainId: number): string {
    const chainRpcMap: { [key: number]: string } = {
      1: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
      137: process.env.POLYGON_RPC_URL || "https://polygon.llamarpc.com",
      56: process.env.BSC_RPC_URL || "https://bsc.llamarpc.com",
      8453: process.env.BASE_RPC_URL || "https://base.llamarpc.com",
      10: process.env.OPTIMISM_RPC_URL || "https://optimism.llamarpc.com",
      42161: process.env.ARBITRUM_RPC_URL || "https://arbitrum.llamarpc.com",
      43114: process.env.AVALANCHE_RPC_URL || "https://avalanche.llamarpc.com"
    };

    const rpcUrl = chainRpcMap[chainId];
    if (!rpcUrl) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    return rpcUrl;
  }


} 
// Infrastructure Adapters
import { createThirdwebClient, Bridge, NATIVE_TOKEN_ADDRESS } from "thirdweb";
import { ethers } from "ethers";
import { SwapRequest, SwapQuote, SwapResult, SwapTransaction, TransactionStatus } from "../../domain/entities/swap";
import { ISwapService } from "../../domain/ports/swap.repository";

export class ThirdwebSwapAdapter implements ISwapService {
  private client: any;
  private static readonly ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)"
  ];

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
        originTokenAddress:
          swapRequest.fromToken.toLowerCase() === 'native'
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
      
      // Determine relayer sender/receiver
      const relayerPrivateKey = process.env.PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY || '';
      const relayerAddressFromKey = relayerPrivateKey && relayerPrivateKey.trim() !== ''
        ? new ethers.Wallet(relayerPrivateKey).address
        : undefined;

      if (!relayerAddressFromKey) {
        throw new Error('Relayer private key is required to prepare swap');
      }

      // If SWAP_SENDER_ADDRESS is set, enforce it matches relayer address to avoid prepare/execute mismatch
      if (
        process.env.SWAP_SENDER_ADDRESS &&
        process.env.SWAP_SENDER_ADDRESS.toLowerCase() !== relayerAddressFromKey.toLowerCase()
      ) {
        throw new Error(
          `Configuration mismatch: SWAP_SENDER_ADDRESS (${process.env.SWAP_SENDER_ADDRESS}) must match relayer address (${relayerAddressFromKey}).`
        );
      }

      // Always use relayer as sender for prepared transactions
      const effectiveSender = relayerAddressFromKey;
      const effectiveReceiver = process.env.SWAP_RECEIVER_ADDRESS || swapRequest.receiver;

      const prepared = await Bridge.Sell.prepare({
        originChainId: swapRequest.fromChainId,
        originTokenAddress:
          swapRequest.fromToken.toLowerCase() === 'native'
            ? NATIVE_TOKEN_ADDRESS
            : swapRequest.fromToken,
        destinationChainId: swapRequest.toChainId,
        destinationTokenAddress: swapRequest.toToken,
        amount: sellAmountWei,
        sender: effectiveSender,
        receiver: effectiveReceiver,
        client: this.client,
      });

      return prepared;
    } catch (error: any) {
      throw new Error(`Failed to prepare swap: ${error.message}`);
    }
  }

  public async executeSwap(swapRequest: SwapRequest): Promise<SwapResult> {
    try {
      // Prepare and quote
      const prepared = await this.prepareSwap(swapRequest);
      const quote = await this.getQuote(swapRequest);

      const transactions: SwapTransaction[] = [];

      // Determine relayer wallet for preflight checks on origin chain
      const relayerPrivateKey = process.env.PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY || '';
      if (!relayerPrivateKey || relayerPrivateKey.trim() === '') {
        throw new Error('Missing PRIVATE_KEY/RELAYER_PRIVATE_KEY for relayer execution');
      }
      const originProvider = new ethers.providers.JsonRpcProvider(this.getChainRpcUrl(swapRequest.fromChainId));
      const relayerWalletOnOrigin = new ethers.Wallet(relayerPrivateKey, originProvider);

      // Config safety: ensure optional SWAP_SENDER_ADDRESS matches relayer wallet used to execute
      if (
        process.env.SWAP_SENDER_ADDRESS &&
        process.env.SWAP_SENDER_ADDRESS.toLowerCase() !== relayerWalletOnOrigin.address.toLowerCase()
      ) {
        throw new Error(
          `Configuration mismatch: SWAP_SENDER_ADDRESS (${process.env.SWAP_SENDER_ADDRESS}) does not match relayer wallet address (${relayerWalletOnOrigin.address}). Ensure the same address is used for prepare & execution.`
        );
      }

      // Preflight: check sufficient balance on origin
      if (swapRequest.fromToken.toLowerCase() === 'native') {
        const balance = await originProvider.getBalance(relayerWalletOnOrigin.address);
        if (balance.lt(ethers.BigNumber.from(swapRequest.amount.toString()))) {
          throw new Error(`Relayer ${relayerWalletOnOrigin.address} has insufficient native balance on chain ${swapRequest.fromChainId}. Required: ${swapRequest.amount.toString()} wei`);
        }
      } else {
        const erc20 = new ethers.Contract(swapRequest.fromToken, ThirdwebSwapAdapter.ERC20_ABI, originProvider);
        const balance: ethers.BigNumber = await erc20.balanceOf(relayerWalletOnOrigin.address);
        if (balance.lt(ethers.BigNumber.from(swapRequest.amount.toString()))) {
          throw new Error(`Relayer ${relayerWalletOnOrigin.address} has insufficient ERC20 balance (${swapRequest.fromToken}) on chain ${swapRequest.fromChainId}. Required: ${swapRequest.amount.toString()} wei`);
        }
      }

      // Prepared output from thirdweb may return either transactions[] or steps[].transactions
      type PreparedTx = { chainId: number; to: string; data: string; value?: string | number | bigint };
      let preparedTxs: PreparedTx[] = [];
      if (Array.isArray(prepared.transactions)) {
        preparedTxs = prepared.transactions as PreparedTx[];
      } else if (Array.isArray(prepared.steps)) {
        for (const step of prepared.steps) {
          if (Array.isArray(step.transactions)) {
            preparedTxs.push(...(step.transactions as PreparedTx[]));
          }
        }
      }

      if (!preparedTxs.length) {
        throw new Error('No transactions returned from Bridge.Sell.prepare');
      }

      // Automatic ERC20 allowance approval on origin chain, if needed
      if (swapRequest.fromToken.toLowerCase() !== 'native') {
        // Tente achar uma transação "approve" na lista preparada para extrair o spender correto
        const APPROVE_SELECTOR = '0x095ea7b3';
        const approveIface = new ethers.utils.Interface([
          "function approve(address spender, uint256 value) returns (bool)"
        ]);

        let spender: string | undefined;
        for (const t of preparedTxs) {
          if (t.chainId === swapRequest.fromChainId && typeof t.data === 'string' && t.data.startsWith(APPROVE_SELECTOR)) {
            try {
              const decoded = approveIface.decodeFunctionData('approve', t.data);
              spender = decoded[0];
              break;
            } catch {}
          }
        }

        // Se não achou approve preparado, use o primeiro tx na chain de origem e tente inferir spender do próximo passo
        if (!spender) {
          const firstOrigin = preparedTxs.find(t => t.chainId === swapRequest.fromChainId);
          // fallback: se não temos info, não forçar approve incorreto
          if (firstOrigin && firstOrigin.to) {
            // Melhor não adivinhar: apenas logar e seguir (a rota pode já incluir o approve)
            // Caso falte allowance, a execução do passo adequado irá falhar e voltaremos aqui em próxima chamada
          }
        }

        if (spender) {
          const erc20 = new ethers.Contract(swapRequest.fromToken, ThirdwebSwapAdapter.ERC20_ABI, originProvider);
          const required = ethers.BigNumber.from(swapRequest.amount.toString());
          const currentAllowance: ethers.BigNumber = await erc20.allowance(relayerWalletOnOrigin.address, spender);
          if (currentAllowance.lt(required)) {
            try {
              const txApprove = await relayerWalletOnOrigin.sendTransaction({
                to: swapRequest.fromToken,
                data: approveIface.encodeFunctionData('approve', [spender, required]),
              });
              await txApprove.wait();
            } catch (e: any) {
              if (e?.code === 'UNPREDICTABLE_GAS_LIMIT') {
                throw new Error(`Cannot estimate gas for approve. Spender ${spender}. Check relayer ERC20 balance and token rules.`);
              }
              throw e;
            }
          }
        }
      }

      for (const txRequest of preparedTxs) {
        const rpcUrl = this.getChainRpcUrl(txRequest.chainId);
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(relayerPrivateKey, provider);

        const valueWei = txRequest.value !== undefined
          ? (typeof txRequest.value === 'bigint'
              ? txRequest.value.toString()
              : txRequest.value.toString())
          : '0';

        // Send transaction
        let sent;
        try {
          // Tentar enviar deixando o node estimar
          sent = await wallet.sendTransaction({
            to: txRequest.to,
            data: txRequest.data,
            value: ethers.utils.parseUnits(valueWei, 'wei'),
          });
        } catch (sendErr: any) {
          if (sendErr?.code === 'UNPREDICTABLE_GAS_LIMIT') {
            // Fallback com gasLimit conservador quando a estimativa de gas falha
            try {
              sent = await wallet.sendTransaction({
                to: txRequest.to,
                data: txRequest.data,
                value: ethers.utils.parseUnits(valueWei, 'wei'),
                gasLimit: ethers.BigNumber.from(3000000),
              });
            } catch (fallbackErr: any) {
              throw new Error(
                `Cannot estimate gas (possible revert). Check: (1) saldo de gas do relayer na chain ${txRequest.chainId}, (2) saldo/allowance do token de origem, (3) SWAP_SENDER_ADDRESS deve ser o mesmo da PRIVATE_KEY (${wallet.address}). Details: ${fallbackErr?.reason || fallbackErr?.message || fallbackErr}`
              );
            }
          } else {
            throw sendErr;
          }
        }

        // Create domain transaction with real hash
        const domainTx = new SwapTransaction(
          sent.hash,
          txRequest.chainId,
          txRequest.to,
          txRequest.data,
          BigInt(valueWei)
        );
        domainTx.updateStatus(TransactionStatus.PENDING);
        transactions.push(domainTx);

        // Wait for confirmation
        const receipt = await sent.wait();
        if (receipt.status === 0) {
          domainTx.updateStatus(TransactionStatus.FAILED);
          throw new Error(`Transaction reverted on chain ${txRequest.chainId} (hash ${sent.hash})`);
        }
        domainTx.updateStatus(TransactionStatus.CONFIRMED);

        // Optional: mark completed after bridge status or after confirmation
        domainTx.updateStatus(TransactionStatus.COMPLETED);
      }

      const result = new SwapResult(transactions, quote);
      result.complete();
      return result;

    } catch (error: any) {
      console.error("[ThirdwebSwapAdapter] Error executing swap:", error);
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
    // Prefer env-specific names; fallback to generic RPC_URL_<CHAIN_ID>
    // Popular networks keep a public fallback to avoid breaking dev
    const envCandidatesByChain: Record<number, Array<string | [string, string]>> = {
      // Mainnets
      1: ["ETHEREUM_RPC_URL", ["FALLBACK", "https://eth.llamarpc.com"]],
      10: ["OPTIMISM_RPC_URL", ["FALLBACK", "https://optimism.llamarpc.com"]],
      14: ["FLARE_RPC_URL"],
      56: ["BSC_RPC_URL", ["FALLBACK", "https://bsc.llamarpc.com"]],
      100: ["GNOSIS_RPC_URL"],
      1101: ["POLYGON_ZKEVM_RPC_URL"],
      1135: ["LISK_RPC_URL"],
      130: ["ZK_SYNC_CLASSIC_RPC_URL"],
      137: ["POLYGON_RPC_URL", ["FALLBACK", "https://polygon.llamarpc.com"]],
      146: ["SONIC_RPC_URL"],
      232: ["CRONOS_ZKEVM_RPC_URL"],
      324: ["ZKSYNC_RPC_URL"],
      388: ["CRONOS_POS_RPC_URL"],
      42161: ["ARBITRUM_RPC_URL", ["FALLBACK", "https://arbitrum.llamarpc.com"]],
      42170: ["ARBITRUM_NOVA_RPC_URL"],
      42220: ["CELO_RPC_URL"],
      43114: ["AVALANCHE_RPC_URL", ["FALLBACK", "https://avalanche.llamarpc.com"]],
      4337: ["PEPE_CHAIN_RPC_URL"],
      466: ["KLAYTN_RPC_URL"],
      480: ["WORLD_CHAIN_RPC_URL"],
      5000: ["MANTLE_RPC_URL"],
      534352: ["SCROLL_RPC_URL"],
      57073: ["X_LAYER_RPC_URL"],
      59144: ["LINEA_RPC_URL"],
      690: ["REDSTONE_RPC_URL"],
      747: ["SEI_EVM_RPC_URL"],
      1868: ["ASTAR_ZKEVM_RPC_URL"],
      1923: ["DOGECOIN_EVM_RPC_URL"],
      1996: ["B3_RPC_URL"],
      2020: ["RONIN_RPC_URL"],
      2187: ["XAI_RPC_URL"],
      2741: ["TENET_RPC_URL"],
      7777777: ["ZORA_RPC_URL"],
      81457: ["BLAST_RPC_URL"],
      8453: ["BASE_RPC_URL", ["FALLBACK", "https://base.llamarpc.com"]],
      34443: ["MODE_RPC_URL"],
      1116: ["CORE_RPC_URL"],
      60808: ["BOB"],
      // Testnets
      11155111: ["SEPOLIA_RPC_URL"],
      97: ["BSC_TESTNET_RPC_URL"],
      10200: ["GNOSIS_CHIADO_RPC_URL"],
      11155420: ["OPTIMISM_SEPOLIA_RPC_URL"],
      84532: ["BASE_SEPOLIA_RPC_URL"],
      534351: ["SCROLL_SEPOLIA_RPC_URL"],
      421614: ["ARBITRUM_SEPOLIA_RPC_URL"],
      168587773: ["BLAST_SEPOLIA_RPC_URL"],
      59141: ["LINEA_GOERLI_RPC_URL"],
      534353: ["SCROLL_TESTNET_RPC_URL"],
      919: ["MODE_SEPOLIA_RPC_URL"],
      80069: ["CELO_ALFAJORES_RPC_URL"],
      1301: ["ZKSYNC_SEPOLIA_RPC_URL"],
      300: ["ZKEVM_TESTNET_RPC_URL"],
      44787: ["CELO_ALFAJORES_RPC_URL"],
      1115: ["CORE_TESTNET_RPC_URL"],
      1114: ["CORE_TESTNET_RPC_URL"],
      64165: ["POLYGON_AMOY_RPC_URL"],
      1946: ["XLAYER_TESTNET_RPC_URL"],
      2021: ["RONIN_TESTNET_RPC_URL"],
      128123: ["ZORA_SEPOLIA_RPC_URL"],
      240: ["NEON_EVM_DEVNET_RPC_URL"],
      1924: ["DOGECOIN_EVM_TESTNET_RPC_URL"],
      1962: ["B3_TESTNET_RPC_URL"],
      1992: ["REDSTONE_HOLESKY_RPC_URL"],
    };

    // Step 1: Try known env var names
    const candidates = envCandidatesByChain[chainId] || [];
    for (const c of candidates) {
      if (Array.isArray(c) && c[0] === "FALLBACK") {
        // use fallback public url only if no env var matched so far
        if (process.env[`RPC_URL_${chainId}`]) return process.env[`RPC_URL_${chainId}`]!;
        return c[1];
      } else if (typeof c === 'string' && process.env[c]) {
        return process.env[c] as string;
      }
    }

    // Step 2: Generic pattern RPC_URL_<CHAIN_ID>
    const generic = process.env[`RPC_URL_${chainId}`];
    if (generic && generic.trim() !== '') return generic;

    // Step 3: For very common chains, keep a safe public default to ease DX
    if (chainId === 1) return "https://eth.llamarpc.com";
    if (chainId === 137) return "https://polygon.llamarpc.com";
    if (chainId === 56) return "https://bsc.llamarpc.com";
    if (chainId === 42161) return "https://arbitrum.llamarpc.com";
    if (chainId === 8453) return "https://base.llamarpc.com";
    if (chainId === 43114) return "https://avalanche.llamarpc.com";
    if (chainId === 10) return "https://optimism.llamarpc.com";

    throw new Error(`RPC URL not configured for chainId ${chainId}. Set env RPC_URL_${chainId} or proper network variable.`);
  }


} 
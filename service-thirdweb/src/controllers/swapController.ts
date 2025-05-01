// src/controllers/swapController.ts
// cspell:disable

import { Request, Response } from "express";
import { Bridge, NATIVE_TOKEN_ADDRESS } from "thirdweb";
import { ethers } from "ethers";

// Importing the thirdweb client
import { thirdwebSdk } from "../utils/thirdwebClient";

/*
  cspell:disable
  // If you want to disable cSpell for this entire file, use this line.
  // Or add words (e.g., "third-party", "thirdweb") to the cSpell dictionary.
*/

// Helper to serialize BigInt to JSON
function safeStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  );
}

export const manualSwap = async (req: Request, res: Response) => {
  console.log("[manualSwap] Starting manual swap operation");
  
  try {
    console.log("[manualSwap] Extracting parameters from request");
    const {
      fromChainId, // ex. 1 (Ethereum)
      toChainId, // ex. 137 (Polygon)
      fromToken, // ex. "NATIVE"
      toToken, // ex. "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" (USDC)
      amount, // ex. "1000000000000000000" => 1e18
    } = req.body;

    console.log("[manualSwap] Parameters received:", { 
      fromChainId, 
      toChainId, 
      fromToken: fromToken === "NATIVE" ? "NATIVE" : `${fromToken.substring(0, 8)}...`, 
      toToken: `${toToken.substring(0, 8)}...`, 
      amount 
    });

    // 1) Check if parameters were provided
    if (!fromChainId || !toChainId || !fromToken || !toToken || !amount) {
      console.warn("[manualSwap] Required parameters missing in request");
      return res.status(400).json({
        error: "Missing parameters",
        requiredParams: ["fromChainId", "toChainId", "fromToken", "toToken", "amount"]
      });
    }

    const sellAmountWei = BigInt(amount);
    console.log("[manualSwap] Value converted to BigInt:", sellAmountWei.toString());

    try {
      // 2) Get Quote
      console.log("[manualSwap] Requesting quote for swap");
      try {
        // Based on the latest Thirdweb documentation
        const quote = await Bridge.Sell.quote({
          originChainId: fromChainId,
          originTokenAddress:
            fromToken === "NATIVE" ? NATIVE_TOKEN_ADDRESS : fromToken,
          destinationChainId: toChainId,
          destinationTokenAddress: toToken,
          sellAmountWei,
          client: thirdwebSdk,
        });

        console.log("[manualSwap] Quote received successfully:", {
          details: safeStringify(quote).substring(0, 200) + "..."
        });
      } catch (quoteError) {
        console.error("[manualSwap] Error getting quote:", quoteError);
        throw new Error(`Failed to get quote: ${quoteError instanceof Error ? quoteError.message : String(quoteError)}`);
      }

      // 3) Prepare transaction
      console.log("[manualSwap] Preparing swap transaction");
      let prepared;
      try {
        prepared = await Bridge.Sell.prepare({
          originChainId: fromChainId,
          originTokenAddress:
            fromToken === "NATIVE" ? NATIVE_TOKEN_ADDRESS : fromToken,
          destinationChainId: toChainId,
          destinationTokenAddress: toToken,
          sellAmountWei,
          sender: process.env.SWAP_SENDER_ADDRESS!, 
          receiver: process.env.SWAP_RECEIVER_ADDRESS!,
          client: thirdwebSdk,
        });

        console.log("[manualSwap] Transaction prepared successfully:", {
          numTransactions: prepared.transactions.length,
          chains: prepared.transactions.map(tx => tx.chainId)
        });
      } catch (prepareError) {
        console.error("[manualSwap] Error preparing transaction:", prepareError);
        throw new Error(`Failed to prepare transaction: ${prepareError instanceof Error ? prepareError.message : String(prepareError)}`);
      }

      // 4) Execute transactions manually using ethers
      console.log("[manualSwap] Starting transaction execution");
      const receipts = [];
      
      for (const [index, txRequest] of prepared.transactions.entries()) {
        console.log(`[manualSwap] Processing transaction ${index+1}/${prepared.transactions.length} on chain ${txRequest.chainId}`);
        
        try {
          // Create provider for the specific chain
          const rpcUrl = getChainRpcUrl(txRequest.chainId);
          console.log(`[manualSwap] Using RPC: ${rpcUrl.substring(0, 20)}...`);
          
          const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
          console.log(`[manualSwap] Provider created for chain ${txRequest.chainId}`);
          
          const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "", provider);
          console.log(`[manualSwap] Wallet configured with address: ${wallet.address}`);
          
          // Send the transaction
          console.log(`[manualSwap] Sending transaction to ${txRequest.to}`);
          console.log(`[manualSwap] Transaction value: ${txRequest.value || "0"} wei`);
          
          const tx = await wallet.sendTransaction({
            to: txRequest.to,
            data: txRequest.data,
            value: ethers.utils.parseUnits(txRequest.value?.toString() || "0", "wei"),
            gasLimit: 3000000 // Adjust as needed
          });

          console.log(`[manualSwap] Transaction sent, hash: ${tx.hash}`);
          console.log(`[manualSwap] Waiting for confirmation...`);
          
          const receipt = await tx.wait();
          console.log(`[manualSwap] Transaction confirmed! Hash: ${receipt.transactionHash}`);
          console.log(`[manualSwap] Blocks confirmed: ${receipt.confirmations}`);
          console.log(`[manualSwap] Gas used: ${receipt.gasUsed.toString()}`);
          
          receipts.push(receipt);
        } catch (txError) {
          console.error(`[manualSwap] Error sending transaction ${index+1}:`, txError);
          throw new Error(`Transaction ${index+1} failed: ${txError instanceof Error ? txError.message : String(txError)}`);
        }

        // 5) Monitor status using Bridge.status
        let statusResp;
        let transactionHashHex = receipts[receipts.length-1].transactionHash;
        
        // Ensure hash starts with 0x
        if (!transactionHashHex.startsWith("0x")) {
          transactionHashHex = `0x${transactionHashHex}`;
          console.log(`[manualSwap] Corrected hash: ${transactionHashHex}`);
        }
        
        console.log(`[manualSwap] Monitoring transaction status ${transactionHashHex}`);
        
        try {
          let attempts = 0;
          const maxAttempts = 30; // Limit attempts
          
          do {
            attempts++;
            console.log(`[manualSwap] Checking status, attempt ${attempts}/${maxAttempts}`);
            await new Promise((r) => setTimeout(r, 4000)); // wait 4s
            
            try {
              statusResp = await Bridge.status({
                transactionHash: transactionHashHex as `0x${string}`,
                chainId: txRequest.chainId,
                client: thirdwebSdk,
              });
              
              console.log(`[manualSwap] Current status: ${statusResp.status}`);
              
              if (statusResp.status === "FAILED") {
                console.error(`[manualSwap] Bridge failed with status: ${statusResp.status}`);
                throw new Error("Bridging failed. Status => " + statusResp.status);
              }
            } catch (statusCheckError) {
              console.warn("[manualSwap] Error checking status:", statusCheckError);
              // Continue and try again
            }
            
            if (attempts >= maxAttempts && statusResp?.status !== "COMPLETED") {
              console.warn(`[manualSwap] Maximum number of attempts reached (${maxAttempts}). Current status: ${statusResp?.status || "Unknown"}`);
              break;
            }
          } while (statusResp?.status !== "COMPLETED");

          console.log(`[manualSwap] Final status of step ${index+1}: ${statusResp?.status || "Unknown"}`);
        } catch (statusError) {
          console.error("[manualSwap] Error monitoring transaction status:", statusError);
          // Continue to the next transaction, but log the error
        }
      }

      console.log("[manualSwap] All transactions processed successfully");
      return res.json({
        message: "Cross-chain swap finalized successfully!",
        receipts: receipts.map(r => r.transactionHash)
      });
    } catch (innerError: any) {
      console.error("[manualSwap] Error in bridge operation:", innerError);
      
      // Try simple transfer if both chains are the same
      if (fromChainId === toChainId) {
        console.log("[manualSwap] Source and destination chains are the same, suggesting simple transfer");
        return res.status(500).json({
          error: "Error in bridge operation. Try simple transfer on the same chain.",
          originalError: innerError.message
        });
      }
      
      throw innerError;
    }
  } catch (error: any) {
    console.error("[manualSwap] Fatal error:", error);
    console.error("[manualSwap] Stack:", error.stack);
    return res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
};

// Helper to get RPC URL for a chain
function getChainRpcUrl(chainId: number): string {
  console.log(`[getChainRpcUrl] Getting RPC URL for chain ${chainId}`);
  
  try {
    let rpcUrl;
    
    switch (chainId) {
      case 1:
        rpcUrl =
          process.env.ETHEREUM_RPC_URL ||
          "https://rpc.ankr.com/eth/f7bf95c709760fc74e969002443ce41f4310f0f42717ba9a3470233c43c85bbf";
        console.log("[getChainRpcUrl] Using RPC of Ethereum");
        break;
      case 137:
        rpcUrl = process.env.POLYGON_RPC_URL || "https://rpc.ankr.com/polygon";
        console.log("[getChainRpcUrl] Using RPC of Polygon");
        break;
      case 56:
        rpcUrl = process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org";
        console.log("[getChainRpcUrl] Using RPC of BSC");
        break;
      case 8453:
        rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";
        console.log("[getChainRpcUrl] Using RPC of Base");
        break;
      case 42161:
        rpcUrl = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
        console.log("[getChainRpcUrl] Using RPC of Arbitrum");
        break;
      case 10:
        rpcUrl = process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io";
        console.log("[getChainRpcUrl] Using RPC of Optimism");
        break;
      default:
        rpcUrl = process.env.RPC_URL || "https://rpc.ankr.com/eth";
        console.log(`[getChainRpcUrl] Chain ID ${chainId} not recognized, using default RPC`);
    }
    
    return rpcUrl;
  } catch (error) {
    console.error(`[getChainRpcUrl] Error getting RPC URL for chain ${chainId}:`, error);
    // Fallback for generic RPC
    return "https://rpc.ankr.com/eth";
  }
}

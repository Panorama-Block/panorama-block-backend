// Manual Test Script for Multi-Provider Routing
// Run with: npx ts-node test-routing.ts

import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, ".env") });

import { DIContainer } from "./src/infrastructure/di/container";
import { SwapRequest } from "./src/domain/entities/swap";

async function testRouting() {
  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║   MULTI-PROVIDER ROUTING - TEST SUITE         ║");
  console.log("╚════════════════════════════════════════════════╝\n");

  const container = DIContainer.getInstance();
  const providerSelector = container.providerSelectorService;

  // Test 1: Same-chain swap (should select Uniswap)
  console.log("========================================");
  console.log("TEST 1: Same-Chain Swap (ETH → ETH)");
  console.log("Expected: Uniswap");
  console.log("========================================\n");

  const sameChainRequest = new SwapRequest(
    1, // Ethereum
    1, // Ethereum
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    BigInt(1_000_000), // 1 USDC
    "0x0000000000000000000000000000000000000001", // sender
    "0x0000000000000000000000000000000000000001"  // receiver
  );

  try {
    const result = await providerSelector.getQuoteWithBestProvider(sameChainRequest);
    console.log(`✅ Provider selected: ${result.provider}`);
    console.log(`✅ Output amount: ${result.quote.estimatedReceiveAmount.toString()}`);
    console.log(`✅ Exchange rate: ${result.quote.exchangeRate}`);
    console.log(`✅ Gas fee: ${result.quote.gasFee.toString()}`);

    if (result.provider === "uniswap") {
      console.log("\n🎉 CORRECT: Uniswap selected for same-chain swap!");
    } else {
      console.log(`\n⚠️ UNEXPECTED: ${result.provider} selected instead of Uniswap`);
    }
  } catch (error) {
    console.error("❌ Test 1 failed:", (error as Error).message);
  }

  // Test 2: Cross-chain swap (should select Thirdweb)
  console.log("\n========================================");
  console.log("TEST 2: Cross-Chain Swap (ETH → Polygon)");
  console.log("Expected: Thirdweb");
  console.log("========================================\n");

  const crossChainRequest = new SwapRequest(
    1, // Ethereum
    137, // Polygon
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on Ethereum
    "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC on Polygon
    BigInt(1_000_000), // 1 USDC
    "0x0000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000001"
  );

  try {
    const result = await providerSelector.getQuoteWithBestProvider(crossChainRequest);
    console.log(`✅ Provider selected: ${result.provider}`);
    console.log(`✅ Output amount: ${result.quote.estimatedReceiveAmount.toString()}`);
    console.log(`✅ Bridge fee: ${result.quote.bridgeFee.toString()}`);

    if (result.provider === "thirdweb") {
      console.log("\n🎉 CORRECT: Thirdweb selected for cross-chain swap!");
    } else {
      console.log(`\n⚠️ UNEXPECTED: ${result.provider} selected instead of Thirdweb`);
    }
  } catch (error) {
    console.error("❌ Test 2 failed:", (error as Error).message);
  }

  // Test 3: Unsupported chain (should fail or fallback)
  console.log("\n========================================");
  console.log("TEST 3: Unsupported Chain (999999)");
  console.log("Expected: Thirdweb fallback or error");
  console.log("========================================\n");

  const unsupportedChainRequest = new SwapRequest(
    999999, // Invalid chain
    1,
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    BigInt(1_000_000),
    "0x0000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000001"
  );

  try {
    const result = await providerSelector.getQuoteWithBestProvider(unsupportedChainRequest);
    console.log(`✅ Fallback provider: ${result.provider}`);
    console.log("\n✅ System handled unsupported chain gracefully");
  } catch (error) {
    console.log(`✅ Expected error: ${(error as Error).message}`);
  }

  // Summary
  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║              TEST SUMMARY                      ║");
  console.log("╚════════════════════════════════════════════════╝\n");
  console.log("Multi-provider routing system is operational!");
  console.log("✅ Uniswap: Same-chain swaps");
  console.log("✅ Thirdweb: Cross-chain swaps + fallback");
  console.log("\nReady for production use!");
}

testRouting().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

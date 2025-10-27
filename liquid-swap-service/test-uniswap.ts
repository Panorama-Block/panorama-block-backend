// Manual Test Script for Uniswap Provider
// Run with: npx ts-node test-uniswap.ts

import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, ".env") });

import { UniswapProviderAdapter } from "./src/infrastructure/adapters/uniswap.provider.adapter";
import { SwapRequest } from "./src/domain/entities/swap";

/**
 * Test 1: Check if provider is enabled and configured
 */
async function test1_CheckConfiguration() {
  console.log("\n========================================");
  console.log("TEST 1: Configuration Check");
  console.log("========================================\n");

  const apiKey = process.env.UNISWAP_API_KEY;
  const enabled = process.env.UNISWAP_ENABLED;

  console.log("UNISWAP_ENABLED:", enabled);
  console.log("UNISWAP_API_KEY:", apiKey ? `${apiKey.substring(0, 10)}...` : "NOT SET");

  if (!apiKey || apiKey === "your_api_key_here") {
    console.log("\n❌ ERRO: Configure sua UNISWAP_API_KEY no arquivo .env");
    console.log("Obtenha sua key em: https://dashboard.uniswap.org");
    return false;
  }

  if (enabled !== "true") {
    console.log("\n⚠️ AVISO: UNISWAP_ENABLED não está como 'true'");
    return false;
  }

  console.log("\n✅ Configuração OK");
  return true;
}

/**
 * Test 2: Test API connection
 */
async function test2_TestConnection() {
  console.log("\n========================================");
  console.log("TEST 2: API Connection Test");
  console.log("========================================\n");

  try {
    const provider = new UniswapProviderAdapter();
    const connected = await provider.testConnection();

    if (connected) {
      console.log("✅ Conexão com Uniswap API funcionando!");
      return true;
    } else {
      console.log("❌ Falha na conexão (provider desabilitado ou API key inválida)");
      return false;
    }
  } catch (error) {
    console.error("❌ Erro ao testar conexão:", (error as Error).message);
    return false;
  }
}

/**
 * Test 3: Test supportsRoute
 */
async function test3_TestSupportsRoute() {
  console.log("\n========================================");
  console.log("TEST 3: Route Support Check");
  console.log("========================================\n");

  const provider = new UniswapProviderAdapter();

  // Test 1: Same-chain (should work)
  console.log("Test 3.1: Same-chain (Ethereum → Ethereum)");
  const sameChainSupport = await provider.supportsRoute({
    fromChainId: 1,
    toChainId: 1,
    fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    toToken: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
  });
  console.log(sameChainSupport ? "✅ Suportado" : "❌ Não suportado");

  // Test 2: Cross-chain (should NOT work)
  console.log("\nTest 3.2: Cross-chain (Ethereum → Polygon)");
  const crossChainSupport = await provider.supportsRoute({
    fromChainId: 1,
    toChainId: 137,
    fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    toToken: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  });
  console.log(!crossChainSupport ? "✅ Corretamente rejeitado" : "❌ Erro: deveria rejeitar");

  // Test 3: Unsupported chain
  console.log("\nTest 3.3: Unsupported chain (chain 999999)");
  const unsupportedChain = await provider.supportsRoute({
    fromChainId: 999999,
    toChainId: 999999,
    fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    toToken: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  });
  console.log(!unsupportedChain ? "✅ Corretamente rejeitado" : "❌ Erro: deveria rejeitar");

  return sameChainSupport && !crossChainSupport && !unsupportedChain;
}

/**
 * Test 4: Test getQuote (REAL API CALL)
 */
async function test4_TestGetQuote() {
  console.log("\n========================================");
  console.log("TEST 4: Get Quote (REAL API CALL)");
  console.log("========================================\n");

  try {
    const provider = new UniswapProviderAdapter();

    // Create a small swap request (1 USDC → WETH on Ethereum)
    const swapRequest = new SwapRequest(
      1, // Ethereum
      1, // Ethereum
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
      BigInt(1_000_000), // 1 USDC (6 decimals)
      "0x0000000000000000000000000000000000000001", // Dummy sender
      "0x0000000000000000000000000000000000000001" // Dummy receiver
    );

    console.log("Requesting quote: 1 USDC → WETH on Ethereum...\n");

    const quote = await provider.getQuote(swapRequest);

    console.log("✅ Quote obtido com sucesso!");
    console.log("\nDetalhes do Quote:");
    console.log("-------------------");
    console.log("Estimated Receive:", quote.estimatedReceiveAmount.toString(), "wei");
    console.log("Bridge Fee:", quote.bridgeFee.toString(), "wei");
    console.log("Gas Fee:", quote.gasFee.toString(), "wei");
    console.log("Exchange Rate:", quote.exchangeRate);
    console.log("Estimated Duration:", quote.estimatedDuration, "seconds");
    console.log("Total Fees:", quote.getTotalFees().toString(), "wei");

    // Convert to human-readable
    const receiveETH = Number(quote.estimatedReceiveAmount) / 1e18;
    const gasFeeETH = Number(quote.gasFee) / 1e18;

    console.log("\nHuman-readable:");
    console.log("You would receive ~", receiveETH.toFixed(6), "WETH");
    console.log("Gas cost ~", gasFeeETH.toFixed(6), "ETH");

    return true;
  } catch (error) {
    console.error("❌ Erro ao obter quote:", (error as Error).message);
    return false;
  }
}

/**
 * Test 5: Test prepareSwap (REAL API CALL)
 */
async function test5_TestPrepareSwap() {
  console.log("\n========================================");
  console.log("TEST 5: Prepare Swap (REAL API CALL)");
  console.log("========================================\n");

  console.log("⚠️ NOTA: Este teste pode falhar com APPROVAL_REQUIRED");
  console.log("Isso é ESPERADO - significa que o token precisa de aprovação\n");

  try {
    const provider = new UniswapProviderAdapter();

    const swapRequest = new SwapRequest(
      1,
      1,
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
      BigInt(1_000_000),
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000001"
    );

    console.log("Preparing swap: 1 USDC → WETH...\n");

    const prepared = await provider.prepareSwap(swapRequest);

    console.log("✅ Swap preparado com sucesso!");
    console.log("\nDetalhes:");
    console.log("---------");
    console.log("Provider:", prepared.provider);
    console.log("Transactions count:", prepared.transactions.length);
    console.log("Estimated duration:", prepared.estimatedDuration, "seconds");
    console.log("Expires at:", prepared.expiresAt);
    console.log("Routing:", prepared.metadata?.routing);

    console.log("\nTransaction details:");
    prepared.transactions.forEach((tx, i) => {
      console.log(`\nTransaction ${i + 1}:`);
      console.log("  Chain ID:", tx.chainId);
      console.log("  To:", tx.to);
      console.log("  Value:", tx.value);
      console.log("  Data length:", tx.data.length, "bytes");
      if (tx.gasLimit) console.log("  Gas Limit:", tx.gasLimit);
    });

    return true;
  } catch (error) {
    const message = (error as Error).message;

    if (message.includes("APPROVAL_REQUIRED") || message.includes("PERMIT2_SIGNATURE_REQUIRED")) {
      console.log("⚠️ Aprovação necessária (esperado):", message);
      console.log("\n✅ Teste passou - provider está funcionando corretamente");
      return true;
    }

    console.error("❌ Erro inesperado:", message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log("╔════════════════════════════════════════════════╗");
  console.log("║  UNISWAP PROVIDER ADAPTER - TEST SUITE        ║");
  console.log("╚════════════════════════════════════════════════╝");

  const results = {
    test1: false,
    test2: false,
    test3: false,
    test4: false,
    test5: false,
  };

  // Test 1: Configuration
  results.test1 = await test1_CheckConfiguration();
  if (!results.test1) {
    console.log("\n❌ Teste 1 falhou. Corrija a configuração antes de continuar.");
    process.exit(1);
  }

  // Test 2: Connection
  results.test2 = await test2_TestConnection();
  if (!results.test2) {
    console.log("\n❌ Teste 2 falhou. Verifique sua API key.");
    process.exit(1);
  }

  // Test 3: Route support
  results.test3 = await test3_TestSupportsRoute();

  // Test 4: Get quote (real API call)
  results.test4 = await test4_TestGetQuote();

  // Test 5: Prepare swap (real API call)
  results.test5 = await test5_TestPrepareSwap();

  // Summary
  console.log("\n\n╔════════════════════════════════════════════════╗");
  console.log("║              TEST SUMMARY                      ║");
  console.log("╚════════════════════════════════════════════════╝\n");

  console.log("Test 1 - Configuration:", results.test1 ? "✅ PASS" : "❌ FAIL");
  console.log("Test 2 - Connection:", results.test2 ? "✅ PASS" : "❌ FAIL");
  console.log("Test 3 - Route Support:", results.test3 ? "✅ PASS" : "❌ FAIL");
  console.log("Test 4 - Get Quote:", results.test4 ? "✅ PASS" : "❌ FAIL");
  console.log("Test 5 - Prepare Swap:", results.test5 ? "✅ PASS" : "❌ FAIL");

  const totalPassed = Object.values(results).filter((r) => r).length;
  const totalTests = Object.keys(results).length;

  console.log("\n-------------------");
  console.log(`Total: ${totalPassed}/${totalTests} tests passed`);
  console.log("-------------------\n");

  if (totalPassed === totalTests) {
    console.log("🎉 TODOS OS TESTES PASSARAM!");
    console.log("✅ Uniswap Provider Adapter está funcionando perfeitamente!");
  } else {
    console.log("⚠️ Alguns testes falharam. Revise os erros acima.");
  }
}

// Execute tests
runAllTests().catch((error) => {
  console.error("\n💥 Erro fatal durante testes:", error);
  process.exit(1);
});

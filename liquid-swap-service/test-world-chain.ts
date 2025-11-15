/**
 * Script de teste para validar a configuração da World Chain no Token Registry
 */

import {
  listSupportedChainsForProvider,
  listSupportedTokens,
  resolveToken,
  getNativeMetadata,
  providerHasChain
} from './src/config/tokens/registry';

console.log('🌍 Testando integração da World Chain (Chain ID: 480)\n');

// Teste 1: Verificar se World Chain está listada para Uniswap
console.log('✅ Teste 1: World Chain está disponível para Uniswap?');
const uniswapChains = listSupportedChainsForProvider('uniswap');
const hasUniswap = uniswapChains.includes(480);
console.log(`   Resultado: ${hasUniswap ? '✅ SIM' : '❌ NÃO'}`);
console.log(`   Chains Uniswap: ${uniswapChains.join(', ')}\n`);

// Teste 2: Verificar se World Chain está listada para Thirdweb
console.log('✅ Teste 2: World Chain está disponível para Thirdweb?');
const thirdwebChains = listSupportedChainsForProvider('thirdweb');
const hasThirdweb = thirdwebChains.includes(480);
console.log(`   Resultado: ${hasThirdweb ? '✅ SIM' : '❌ NÃO'}`);
console.log(`   Chains Thirdweb: ${thirdwebChains.join(', ')}\n`);

// Teste 3: Listar tokens suportados na World Chain para Uniswap
console.log('✅ Teste 3: Tokens suportados na World Chain (Uniswap)');
try {
  const uniswapTokens = listSupportedTokens('uniswap', 480);
  console.log(`   Total de tokens: ${uniswapTokens.length}`);
  uniswapTokens.forEach(token => {
    console.log(`   - ${token.symbol} (${token.name}) - ${token.address}`);
  });
} catch (error) {
  console.log(`   ❌ Erro: ${error}`);
}
console.log('');

// Teste 4: Listar tokens suportados na World Chain para Thirdweb
console.log('✅ Teste 4: Tokens suportados na World Chain (Thirdweb)');
try {
  const thirdwebTokens = listSupportedTokens('thirdweb', 480);
  console.log(`   Total de tokens: ${thirdwebTokens.length}`);
  thirdwebTokens.forEach(token => {
    console.log(`   - ${token.symbol} (${token.name}) - ${token.address}`);
  });
} catch (error) {
  console.log(`   ❌ Erro: ${error}`);
}
console.log('');

// Teste 5: Obter metadados do token nativo (ETH)
console.log('✅ Teste 5: Metadados do token nativo ETH na World Chain');
try {
  const nativeMeta = getNativeMetadata(480);
  console.log(`   Símbolo: ${nativeMeta.symbol}`);
  console.log(`   Nome: ${nativeMeta.name}`);
  console.log(`   Decimals: ${nativeMeta.decimals}`);
  console.log(`   Icon: ${nativeMeta.icon}`);
} catch (error) {
  console.log(`   ❌ Erro: ${error}`);
}
console.log('');

// Teste 6: Resolver token WETH
console.log('✅ Teste 6: Resolver token WETH (0x4200000000000000000000000000000000000006)');
try {
  const wethUniswap = resolveToken('uniswap', 480, '0x4200000000000000000000000000000000000006');
  console.log(`   [Uniswap] Identificador: ${wethUniswap.identifier}`);
  console.log(`   [Uniswap] É nativo? ${wethUniswap.isNative ? 'SIM' : 'NÃO'}`);
  console.log(`   [Uniswap] Símbolo: ${wethUniswap.metadata.symbol}`);
  console.log(`   [Uniswap] Nome: ${wethUniswap.metadata.name}`);
} catch (error) {
  console.log(`   ❌ Erro Uniswap: ${error}`);
}
console.log('');

// Teste 7: Resolver token WLD
console.log('✅ Teste 7: Resolver token WLD (0x2cfc85d8e48f8eab294be644d9e25c3030863003)');
try {
  const wldUniswap = resolveToken('uniswap', 480, '0x2cfc85d8e48f8eab294be644d9e25c3030863003');
  console.log(`   [Uniswap] Identificador: ${wldUniswap.identifier}`);
  console.log(`   [Uniswap] Símbolo: ${wldUniswap.metadata.symbol}`);
  console.log(`   [Uniswap] Nome: ${wldUniswap.metadata.name}`);
  console.log(`   [Uniswap] Decimals: ${wldUniswap.metadata.decimals}`);
} catch (error) {
  console.log(`   ❌ Erro: ${error}`);
}
console.log('');

// Teste 8: Resolver token USDC
console.log('✅ Teste 8: Resolver token USDC (0x79A02482A880bCE3F13e09Da970dC34db4CD24d1)');
try {
  const usdcUniswap = resolveToken('uniswap', 480, '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1');
  console.log(`   [Uniswap] Identificador: ${usdcUniswap.identifier}`);
  console.log(`   [Uniswap] Símbolo: ${usdcUniswap.metadata.symbol}`);
  console.log(`   [Uniswap] Nome: ${usdcUniswap.metadata.name}`);
  console.log(`   [Uniswap] Decimals: ${usdcUniswap.metadata.decimals}`);
} catch (error) {
  console.log(`   ❌ Erro: ${error}`);
}
console.log('');

// Teste 9: Resolver token MCW
console.log('✅ Teste 9: Resolver token MCW (0xf1E7adc9C1743Cd2c6ceA47D0CA43Fad57190616)');
try {
  const mcwUniswap = resolveToken('uniswap', 480, '0xf1E7adc9C1743Cd2c6ceA47D0CA43Fad57190616');
  console.log(`   [Uniswap] Identificador: ${mcwUniswap.identifier}`);
  console.log(`   [Uniswap] Símbolo: ${mcwUniswap.metadata.symbol}`);
  console.log(`   [Uniswap] Nome: ${mcwUniswap.metadata.name}`);
  console.log(`   [Uniswap] Decimals: ${mcwUniswap.metadata.decimals}`);
} catch (error) {
  console.log(`   ❌ Erro: ${error}`);
}
console.log('');

// Teste 10: Verificar provider support
console.log('✅ Teste 10: Verificar suporte de providers para World Chain');
const uniswapSupport = providerHasChain('uniswap', 480);
const thirdwebSupport = providerHasChain('thirdweb', 480);
console.log(`   Uniswap suporta World Chain? ${uniswapSupport ? '✅ SIM' : '❌ NÃO'}`);
console.log(`   Thirdweb suporta World Chain? ${thirdwebSupport ? '✅ SIM' : '❌ NÃO'}`);
console.log('');

console.log('🎉 Testes concluídos!');

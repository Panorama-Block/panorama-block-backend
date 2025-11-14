import { listSupportedChainsForProvider } from './src/config/tokens/registry';

console.log('🔍 Verificando carregamento do registry...\n');

try {
  const uniswapChains = listSupportedChainsForProvider('uniswap');
  const thirdwebChains = listSupportedChainsForProvider('thirdweb');
  
  console.log('Uniswap chains:', uniswapChains);
  console.log('Thirdweb chains:', thirdwebChains);
  
  console.log('\n✅ World Chain (480) em Uniswap?', uniswapChains.includes(480));
  console.log('✅ World Chain (480) em Thirdweb?', thirdwebChains.includes(480));
} catch (error) {
  console.error('❌ Erro:', error);
}

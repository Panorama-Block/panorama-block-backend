// Configurações da Rede Avalanche
const NETWORKS = {
  AVALANCHE: {
    chainId: 43114,
    name: 'Avalanche C-Chain',
    rpcUrl: process.env.RPC_URL_AVALANCHE || 'https://avalanche-mainnet.infura.io/v3/9ff045cf374041eeabdf13a4664ceced',
    explorer: 'https://snowtrace.io',
    nativeCurrency: {
      name: 'AVAX',
      symbol: 'AVAX',
      decimals: 18
    }
  },
  FUJI: {
    chainId: 43113,
    name: 'Avalanche Fuji Testnet',
    rpcUrl: process.env.RPC_URL_FUJI || 'https://api.avax-test.network/ext/bc/C/rpc',
    explorer: 'https://testnet.snowtrace.io',
    nativeCurrency: {
      name: 'AVAX',
      symbol: 'AVAX',
      decimals: 18
    }
  }
};

// Endereços dos Contratos Trader Joe
const TRADER_JOE = {
  ROUTER: process.env.TRADER_JOE_ROUTER || '0x60aE616a2155Ee3d9A68541Ba4544862310933d4',
  FACTORY: process.env.TRADER_JOE_FACTORY || '0x9Ad6C38BE94206cA50bb0d90783171662CD1e917',
  JOE_TOKEN: '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd',
  WAVAX: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7'
};

// Endereços dos Contratos Validation
const VALIDATION = {
  CONTRACT_ADDRESS: process.env.VALIDATION_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000', // Será definido após deploy
  DEFAULT_TAX_RATE: 10, // 10% por padrão
  MAX_TAX_RATE: 100 // Máximo 100%
};

// Endereços dos Contratos Benqi (Mainnet Avalanche - Endereços Oficiais)
const BENQI = {
  COMPTROLLER: process.env.BENQI_COMPTROLLER || '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
  UNITROLLER: process.env.BENQI_UNITROLLER || '0xD7c4006d33DA2A0A8525791ed212bbCD7Aca763F',
  ORACLE: process.env.BENQI_ORACLE || '0x4cC758Fc4d77C88d7105030d82B1740d6b7dFc6E',
  QAVAX: process.env.BENQI_QAVAX || '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
  QUSDC: process.env.BENQI_QUSDC || '0xB715808a78F6041E46d61Cb123C9B3E9BcF8Da77',
  QUSDT: process.env.BENQI_QUSDT || '0xCde5A11a4ACB4eE4c805352Cec57E236bdBC3837',
  QDAI: process.env.BENQI_QDAI || '0x835866d37afb8cb8f8334dccdaf66cf01832ffcf',
  QWETH: process.env.BENQI_QWETH || '0x334ad834cd4481bb02d09615e7c11a00579a7909',
  QBTC: process.env.BENQI_QBTC || '0x2f2c4b3e0f3a9b7f6e3a2f3a9b7f6e3a2f3a9b7f',
  QLINK: process.env.BENQI_QLINK || '0x4e9f683A27a6BdAD3FC2764003759277e936103e',
  QJOE: process.env.BENQI_QJOE || '0x4036cb0D6BF6b5F17Aa4e05191F86D4b1655b0d9',
  QQI: process.env.BENQI_QQI || '0x545356e396350D40cDEa888ad73534517399BF96',
  QCOQ: process.env.BENQI_QCOQ || '0x0eBfebD41e1eA83Be5e911cDCd2730a0CCEE344d'
};



// Tokens Comuns na Avalanche
// Usa variáveis de ambiente se disponíveis, senão usa valores padrão
const COMMON_TOKENS = {
  WAVAX: process.env.WAVAX_ADDRESS || '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
  USDC: process.env.USDC_ADDRESS || '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  USDT: process.env.USDT_ADDRESS || '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
  DAI: process.env.DAI_ADDRESS || '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70',
  WETH: process.env.WETH_ADDRESS || '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
  JOE: process.env.JOE_ADDRESS || '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd',
  LINK: process.env.LINK_ADDRESS || '0x5947BB275c521040051D82396192181b413227A3',
  UNI: process.env.UNI_ADDRESS || '0x8eBAf22B6F053dFFeaf46f4Dd9eFA95D89ba8580',
  
  // Tokens DeFi (opcional)
  AAVE: process.env.AAVE_ADDRESS || '0x63a72806098Bd3D9520cC43356dD78afe5D386D9',
  COMP: process.env.COMP_ADDRESS || '0xc3048E19E76CB9a3Aa9d77D8C03c29Fc906e2437',
  CRV: process.env.CRV_ADDRESS || '0x249848BeCA43aC405b8102Ec90Dd5F22CA513c06',
  
  // Tokens de Meme (opcional - você pode adicionar mais)
  PEPE: process.env.PEPE_ADDRESS || '0x0000000000000000000000000000000000000000',
  DOGE: process.env.DOGE_ADDRESS || '0x0000000000000000000000000000000000000000'
};

// Função para adicionar novos tokens dinamicamente
function addToken(symbol, address) {
  COMMON_TOKENS[symbol.toUpperCase()] = address;
  console.log(`✅ Token ${symbol} adicionado: ${address}`);
}

// Função para obter endereço de um token
function getTokenAddress(symbol) {
  return COMMON_TOKENS[symbol.toUpperCase()] || null;
}

// Função para listar todos os tokens disponíveis
function listTokens() {
  return Object.keys(COMMON_TOKENS).map(symbol => ({
    symbol,
    address: COMMON_TOKENS[symbol]
  }));
}

// Configurações de Slippage
const SLIPPAGE_OPTIONS = {
  LOW: 0.5,      // 0.5%
  MEDIUM: 1.0,   // 1.0%
  HIGH: 2.0,     // 2.0%
  VERY_HIGH: 5.0 // 5.0%
};

// Configurações de Gas
const GAS_SETTINGS = {
  DEFAULT_GAS_LIMIT: 300000,
  SWAP_GAS_LIMIT: 500000,
  APPROVE_GAS_LIMIT: 100000,
  MAX_PRIORITY_FEE: '2 gwei',
  MAX_FEE_PER_GAS: '50 gwei'
};

// URLs das APIs
const API_URLS = {
  TRADER_JOE: 'https://api.traderjoexyz.com',

  COINGECKO: 'https://api.coingecko.com/api/v3',
  SNOWTRACE: 'https://api.snowtrace.io/api'
};

// Configurações de Rate Limiting
const RATE_LIMIT = {
  WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutos
  MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
};

// Configurações de Segurança
const SECURITY = {
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-here',
  SIGNATURE_EXPIRY: 5 * 60 * 1000, // 5 minutos
  MAX_AMOUNT: '1000000', // 1M AVAX
  MIN_AMOUNT: '0.000001' // 0.000001 AVAX
};

module.exports = {
  NETWORKS,
  TRADER_JOE,
  VALIDATION,
  BENQI,
  COMMON_TOKENS,
  SLIPPAGE_OPTIONS,
  GAS_SETTINGS,
  API_URLS,
  RATE_LIMIT,
  SECURITY,
  // Funções para gerenciar tokens
  addToken,
  getTokenAddress,
  listTokens
};

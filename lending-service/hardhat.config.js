require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    avalanche: {
      url: process.env.RPC_URL_AVALANCHE || "https://api.avax.network/ext/bc/C/rpc",
      chainId: 43114,
      accounts: process.env.PRIVATE_KEY_DEPLOY ? [process.env.PRIVATE_KEY_DEPLOY] : [],
      gasPrice: 25000000000, // 25 gwei
    },
    fuji: {
      url: process.env.RPC_URL_FUJI || "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: process.env.PRIVATE_KEY_DEPLOY ? [process.env.PRIVATE_KEY_DEPLOY] : [],
      gasPrice: 25000000000,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    }
  },
  etherscan: {
    apiKey: {
      avalanche: process.env.SNOWTRACE_API_KEY || "",
      avalancheFujiTestnet: process.env.SNOWTRACE_API_KEY || ""
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};

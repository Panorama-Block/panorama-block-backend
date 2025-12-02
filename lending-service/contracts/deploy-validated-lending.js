/**
 * Script para fazer deploy do contrato ValidatedLending
 *
 * Como usar:
 * 1. Certifique-se de ter o Hardhat instalado: npm install --save-dev hardhat
 * 2. Configure seu .env com PRIVATE_KEY e RPC_URL_AVALANCHE
 * 3. Execute: npx hardhat run contracts/deploy-validated-lending.js --network avalanche
 */

const hre = require("hardhat");

async function main() {
  console.log("🚀 Iniciando deploy do ValidatedLending...\n");

  // Endereço do contrato de validação existente
  const VALIDATION_CONTRACT = process.env.VALIDATION_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000";

  if (VALIDATION_CONTRACT === "0x0000000000000000000000000000000000000000") {
    console.error("❌ ERRO: VALIDATION_CONTRACT_ADDRESS não definido no .env");
    process.exit(1);
  }

  console.log("📋 Configuração:");
  console.log(`   Validation Contract: ${VALIDATION_CONTRACT}`);
  console.log(`   Network: ${hre.network.name}`);
  console.log(`   Chain ID: ${(await hre.ethers.provider.getNetwork()).chainId}\n`);

  // Obter signer
  const [deployer] = await hre.ethers.getSigners();
  console.log(`👤 Deploying com a conta: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 Saldo da conta: ${hre.ethers.formatEther(balance)} AVAX\n`);

  // Deploy do contrato
  console.log("⏳ Fazendo deploy do ValidatedLending...");
  const ValidatedLending = await hre.ethers.getContractFactory("ValidatedLending");
  const validatedLending = await ValidatedLending.deploy(VALIDATION_CONTRACT);

  await validatedLending.waitForDeployment();
  const contractAddress = await validatedLending.getAddress();

  console.log("✅ ValidatedLending deployado com sucesso!");
  console.log(`📍 Endereço: ${contractAddress}\n`);

  // Verificar deployment
  console.log("🔍 Verificando deployment...");
  const validationContractAddr = await validatedLending.validationContract();
  const owner = await validatedLending.owner();

  console.log("✅ Verificação completa:");
  console.log(`   Validation Contract: ${validationContractAddr}`);
  console.log(`   Owner: ${owner}\n`);

  // Salvar endereço no .env
  console.log("💾 Para usar este contrato, adicione ao .env:");
  console.log(`VALIDATED_LENDING_CONTRACT=${contractAddress}\n`);

  // Instruções para verificação no Snowtrace
  console.log("📊 Para verificar no Snowtrace:");
  console.log(`npx hardhat verify --network avalanche ${contractAddress} ${VALIDATION_CONTRACT}\n`);

  // Próximos passos
  console.log("📋 Próximos passos:");
  console.log("1. Adicionar VALIDATED_LENDING_CONTRACT ao .env");
  console.log("2. Verificar contrato no Snowtrace (comando acima)");
  console.log("3. Atualizar backend para usar o novo contrato");
  console.log("4. Testar no frontend\n");

  console.log("🎉 Deploy concluído com sucesso!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erro no deploy:", error);
    process.exit(1);
  });

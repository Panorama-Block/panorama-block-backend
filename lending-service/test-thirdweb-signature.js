const { ethers } = require('ethers');

// Simula diferentes formas de assinar a mensagem
async function testDifferentSignatures() {
  console.log('🔍 Testando diferentes formas de assinar...\n');

  const privateKey = '0xdc5d66eafc371a54c9c999db024a74b6eb26b6ed12a437742348db00c4390e48';
  const wallet = new ethers.Wallet(privateKey);
  const address = wallet.address;
  
  console.log('Wallet Address:', address);
  
  const message = `Validate and supply 1000000000000000000 of token 0x4A2c2838c3904D4B0B4a82eD7a3d0d3a0B4a82eD7\nTimestamp: ${Date.now()}`;
  console.log('Message:', message);
  
  // Teste 1: signMessage normal (ethers.js)
  console.log('\n1. Testando signMessage (ethers.js)...');
  try {
    const signature1 = await wallet.signMessage(message);
    console.log('   Signature:', signature1);
    
    const recovered1 = ethers.verifyMessage(message, signature1);
    console.log('   Recovered:', recovered1);
    console.log('   Match:', recovered1.toLowerCase() === address.toLowerCase());
  } catch (error) {
    console.error('   Erro:', error.message);
  }
  
  // Teste 2: signMessage com array de bytes
  console.log('\n2. Testando signMessage com array de bytes...');
  try {
    const messageBytes = ethers.toUtf8Bytes(message);
    const signature2 = await wallet.signMessage(messageBytes);
    console.log('   Signature:', signature2);
    
    const recovered2 = ethers.verifyMessage(messageBytes, signature2);
    console.log('   Recovered:', recovered2);
    console.log('   Match:', recovered2.toLowerCase() === address.toLowerCase());
  } catch (error) {
    console.error('   Erro:', error.message);
  }
  
  // Teste 3: signMessage com hash da mensagem
  console.log('\n3. Testando signMessage com hash...');
  try {
    const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message));
    const signature3 = await wallet.signMessage(messageHash);
    console.log('   Signature:', signature3);
    
    const recovered3 = ethers.verifyMessage(messageHash, signature3);
    console.log('   Recovered:', recovered3);
    console.log('   Match:', recovered3.toLowerCase() === address.toLowerCase());
  } catch (error) {
    console.error('   Erro:', error.message);
  }
  
  // Teste 4: Assinatura personalizada (como thirdweb pode fazer)
  console.log('\n4. Testando assinatura personalizada...');
  try {
    const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message));
    const signature4 = await wallet.signMessage(ethers.getBytes(messageHash));
    console.log('   Signature:', signature4);
    
    const recovered4 = ethers.verifyMessage(ethers.getBytes(messageHash), signature4);
    console.log('   Recovered:', recovered4);
    console.log('   Match:', recovered4.toLowerCase() === address.toLowerCase());
  } catch (error) {
    console.error('   Erro:', error.message);
  }
  
  // Teste 5: Verificar se a mensagem está sendo processada corretamente
  console.log('\n5. Verificando processamento da mensagem...');
  console.log('   Message length:', message.length);
  console.log('   Message bytes:', ethers.toUtf8Bytes(message).length);
  console.log('   Message hash:', ethers.keccak256(ethers.toUtf8Bytes(message)));
}

testDifferentSignatures().catch(console.error);

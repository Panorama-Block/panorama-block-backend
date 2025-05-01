# Service Thirdweb - Panorama Block

Serviço dedicado para integrações com o Thirdweb SDK, fornecendo endpoints para swap, bridge e autenticação SIWE (Sign-In with Ethereum).

## Sobre

Este microserviço é parte da arquitetura do Panorama Block, responsável por:

- Executar swaps cross-chain via Universal Bridge do Thirdweb
- Fornecer endpoints de autenticação SIWE (opcional)
- Integrar com carteiras inteligentes (smart wallets) e account abstraction

## Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas credenciais

# Executar em desenvolvimento
npm run dev

# Construir para produção
npm run build

# Executar em produção
npm start
```

## Endpoints

### Swap

- `POST /swap/manual`: Executa um swap manual
  ```json
  {
    "fromChainId": 1,
    "toChainId": 8453,
    "fromToken": "NATIVE", 
    "toToken": "0xSOME_TOKEN_ADDRESS",
    "amount": "1000000000000000000"
  }
  ```

### Autenticação (opcional)

- `POST /auth/login`: Gera um payload para login SIWE
  ```json
  {
    "address": "0xYOUR_WALLET_ADDRESS"
  }
  ```

- `POST /auth/verify`: Verifica a assinatura e gera um token JWT
  ```json
  {
    "payload": { ... }, 
    "signature": "0xSIGNATURE"
  }
  ```

## Desenvolvimento

Estrutura de arquivos:
- `/src`: Código fonte
  - `/routes`: Definição de rotas
  - `/controllers`: Lógica de negócio
  - `/middlewares`: Middlewares (autenticação, etc.)
  - `/utils`: Utilitários (cliente Thirdweb, etc.)
  - `/config`: Configurações 
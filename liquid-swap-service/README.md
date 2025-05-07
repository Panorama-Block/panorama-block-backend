# Liquid Swap Service

Este serviço é responsável pelas operações de swap cross-chain no PanoramaBlock, utilizando o ThirdWeb SDK.

## Tecnologias

- Node.js
- TypeScript
- Express
- ThirdWeb SDK
- Ethers.js

## Configuração

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Crie um arquivo `.env` baseado no `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Edite o arquivo `.env` e preencha as variáveis de ambiente necessárias.

## Desenvolvimento

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Produção

```bash
npm start
```

## Docker

```bash
# Build da imagem
docker build -t liquid-swap-service .

# Execução do contêiner
docker run -p 3003:3003 --env-file .env liquid-swap-service
```

## Endpoints

- `GET /health`: Verificação de saúde do serviço
- `GET /`: Informações sobre o serviço
- `POST /swap/manual`: Executar swap cross-chain (requer autenticação JWT)

## Autenticação

Este serviço utiliza autenticação baseada em JWT fornecida pelo Auth Service. Todos os endpoints de swap necessitam de um token JWT válido no cabeçalho de autorização:

```
Authorization: Bearer your_jwt_token
``` 
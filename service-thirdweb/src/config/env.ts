import dotenv from "dotenv";
import { cleanEnv, str, port, bool } from "envalid";

dotenv.config();

export default cleanEnv(process.env, {
  PORT: port({ default: 3001 }),
  RPC_URL: str({
    default:
      "https://rpc.ankr.com/eth/f7bf95c709760fc74e969002443ce41f4310f0f42717ba9a3470233c43c85bbf",
  }),
  PRIVATE_KEY: str({ default: "" }),
  THIRDWEB_CLIENT_ID: str({ default: "" }),
  SWAP_SENDER_ADDRESS: str({ default: "" }),
  SWAP_RECEIVER_ADDRESS: str({ default: "" }),
  AUTH_PRIVATE_KEY: str({ default: "" }),
  AUTH_DOMAIN: str({ default: "panoramablock.com" }),

  // Configuração para modo development/production
  NODE_ENV: str({
    choices: ["development", "test", "production"],
    default: "development",
  }),
  DEBUG: bool({ default: false }),
}); 
import { IExecutionPort, ExecutionOptions, PreparedOriginTx, ExecutionResult } from "../../domain/ports/execution.port";
import { EngineTokenManager } from "./engine.token.manager";

/**
 * EngineExecutionAdapter
 * Minimal adapter to submit prepared origin transactions to thirdweb Engine
 * using ERC-4337 session keys (smart accounts).
 */
export class EngineExecutionAdapter implements IExecutionPort {
  private readonly url: string;
  private readonly tokenManager: EngineTokenManager;

  constructor() {
    const url = process.env.ENGINE_URL;
    const token = process.env.ENGINE_ACCESS_TOKEN || process.env.ENGINE_API_TOKEN;
    if (!url) {
      throw new Error("ENGINE_URL is required when ENGINE_ENABLED=true");
    }
    this.url = url.replace(/\/$/, "");
    this.tokenManager = new EngineTokenManager(
      this.url,
      token,
      process.env.THIRDWEB_CLIENT_ID,
      process.env.THIRDWEB_SECRET_KEY
    );
  }

  public async executeOriginTxs(
    txs: PreparedOriginTx[],
    options: ExecutionOptions,
    meta: { sender: string }
  ): Promise<ExecutionResult[]> {
    if (!Array.isArray(txs) || txs.length === 0) {
      throw new Error("No transactions to execute");
    }

    // Payload compatible with engine smart-wallet API (path may vary by version)
    const payload: any = {
      transactions: txs.map((t) => ({
        chainId: t.chainId,
        to: t.to as `0x${string}`,
        data: t.data as `0x${string}`,
        // ensure string serialization; avoid BigInt in JSON.stringify
        value:
          typeof (t as any).value === "bigint"
            ? (t as any).value.toString()
            : `${(t as any).value ?? "0"}`,
      })),
      executionOptions: {
        type: options.type,
        smartAccountAddress: options.smartAccountAddress,
        signerAddress: options.signerAddress,
      },
      from: meta.sender,
    };

    const endpointCandidates = [
      "/smart-wallet/send-transaction", // common path in recent engine versions
      "/transactions/send",             // fallback
    ];

    let lastErr: any;
    for (const path of endpointCandidates) {
      try {
        const accessToken = await this.tokenManager.getToken();
        const res = await fetch(`${this.url}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          // replacer to safely serialize any unexpected BigInt
          body: JSON.stringify(payload, (_k, v) =>
            typeof v === "bigint" ? v.toString() : v
          ),
        });

        if (!res.ok) {
          const text = await res.text();
          // if unauthorized, try to refresh token once and retry immediately
          if (res.status === 401) {
            this.tokenManager.invalidate();
            const retryToken = await this.tokenManager.getToken();
            const retry = await fetch(`${this.url}${path}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(retryToken ? { Authorization: `Bearer ${retryToken}` } : {}),
              },
              body: JSON.stringify(payload, (_k, v) =>
                typeof v === "bigint" ? v.toString() : v
              ),
            });
            if (!retry.ok) {
              const t2 = await retry.text();
              throw new Error(`Engine error (${retry.status}): ${t2}`);
            }
            const out2: any = await retry.json();
            const results2 = (out2.results || out2.result || out2 || []) as any[];
            return results2.map((r) => ({
              transactionHash: r.transactionHash || r.txHash || r.hash,
              chainId: r.chainId || txs[0].chainId,
              userOpHash: r.userOpHash || r.opHash,
            }));
          }
          throw new Error(`Engine error (${res.status}): ${text}`);
        }

        const out: any = await res.json();
        const results = (out.results || out.result || out || []) as any[];
        return results.map((r) => ({
          transactionHash: r.transactionHash || r.txHash || r.hash,
          chainId: r.chainId || txs[0].chainId,
          userOpHash: r.userOpHash || r.opHash,
        }));
      } catch (err) {
        lastErr = err;
      }
    }

    throw lastErr ?? new Error("Failed to send transactions via Engine");
  }
}

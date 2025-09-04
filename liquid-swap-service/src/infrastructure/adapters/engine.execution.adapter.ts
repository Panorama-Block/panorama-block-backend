import { IExecutionPort, ExecutionOptions, PreparedOriginTx, ExecutionResult } from "../../domain/ports/execution.port";

/**
 * EngineExecutionAdapter
 * Minimal adapter to submit prepared origin transactions to thirdweb Engine
 * using ERC-4337 session keys (smart accounts).
 */
export class EngineExecutionAdapter implements IExecutionPort {
  private readonly url: string;
  private readonly token?: string;

  constructor() {
    const url = process.env.ENGINE_URL;
    const token = process.env.ENGINE_ACCESS_TOKEN || process.env.ENGINE_API_TOKEN;
    if (!url) {
      throw new Error("ENGINE_URL is required when ENGINE_ENABLED=true");
    }
    this.url = url.replace(/\/$/, "");
    this.token = token;
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
        value: t.value ?? "0",
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
        const res = await fetch(`${this.url}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const text = await res.text();
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


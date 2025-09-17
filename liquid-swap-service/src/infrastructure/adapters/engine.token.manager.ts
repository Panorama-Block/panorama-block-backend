// EngineTokenManager: obtains and caches an Engine access token.
// Sources:
// 1) Static token from env (ENGINE_ACCESS_TOKEN / ENGINE_API_TOKEN)
// 2) Dynamic login using @thirdweb-dev/engine with THIRDWEB_CLIENT_ID/SECRET_KEY

function base64UrlDecode(input: string): string {
  input = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = input.length % 4;
  if (pad) input += "=".repeat(4 - pad);
  return Buffer.from(input, "base64").toString("utf8");
}

function decodeJwtExpiryMs(token: string): number | undefined {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return undefined;
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    if (typeof payload.exp === "number") {
      return payload.exp * 1000; // seconds -> ms
    }
  } catch (_) {}
  return undefined;
}

export class EngineTokenManager {
  private token?: string;
  private expiresAtMs?: number; // epoch millis

  constructor(
    private readonly url: string,
    private readonly staticToken?: string,
    private readonly clientId?: string,
    private readonly secretKey?: string
  ) {
    if (staticToken) {
      this.token = staticToken;
      this.expiresAtMs = decodeJwtExpiryMs(staticToken);
    }
  }

  public invalidate() {
    this.token = undefined;
    this.expiresAtMs = undefined;
  }

  private isValid(): boolean {
    if (!this.token) return false;
    if (!this.expiresAtMs) return true; // no exp => treat as non-expiring
    // refresh 60s before expiry
    return Date.now() < this.expiresAtMs - 60_000;
  }

  public async getToken(): Promise<string | undefined> {
    if (this.isValid()) return this.token;

    // If we have a static token but it looks expired, just reuse it (no way to refresh)
    if (this.staticToken && !this.clientId && !this.secretKey) {
      this.token = this.staticToken;
      this.expiresAtMs = decodeJwtExpiryMs(this.staticToken);
      return this.token;
    }

    if (this.clientId && this.secretKey) {
      try {
        // dynamic import to avoid hard dependency if package isn't installed
        const mod = await import("@thirdweb-dev/engine").catch(() => undefined as any);
        if (!mod || !mod.Engine) {
          throw new Error(
            "@thirdweb-dev/engine not installed. Install or set ENGINE_ACCESS_TOKEN."
          );
        }
        const engine = new mod.Engine({
          url: this.url,
          clientId: this.clientId,
          secretKey: this.secretKey,
        });
        // Request/refresh the token
        await engine.login();

        let token: string | undefined = undefined;
        if (typeof engine.getAccessToken === "function") {
          token = await engine.getAccessToken();
        } else if (typeof (engine as any).accessToken === "string") {
          token = (engine as any).accessToken;
        }

        if (!token) {
          throw new Error("Engine SDK did not expose the access token");
        }

        this.token = token;
        this.expiresAtMs = decodeJwtExpiryMs(token);
        return this.token;
      } catch (err) {
        console.error("[EngineTokenManager] Failed to obtain token via SDK:", (err as Error).message);
        return undefined;
      }
    }

    return undefined;
  }
}


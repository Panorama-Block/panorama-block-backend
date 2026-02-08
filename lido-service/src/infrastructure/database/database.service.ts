import { Pool, PoolClient, QueryResult } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

export class DatabaseService {
  private static instance: DatabaseService | null = null;
  private readonly pool: Pool;
  private readonly schema: string;
  private readonly configuredClients = new WeakSet<PoolClient>();
  private ensureSchemaPromise: Promise<void> | null = null;

  static isConfigured(env = process.env): boolean {
    return Boolean(env.DATABASE_URL && env.DATABASE_URL.trim().length > 0);
  }

  static getSchema(env = process.env): string {
    const raw = (env.LIDO_DB_SCHEMA || env.DB_SCHEMA || 'lido').trim();
    if (!raw) return 'lido';

    // Prevent SQL injection in identifiers (schema/table names cannot be parameterized).
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(raw)) {
      throw new Error(`Invalid DB schema name: "${raw}"`);
    }

    return raw;
  }

  private constructor() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required to enable persistence');
    }

    this.schema = DatabaseService.getSchema(process.env);

    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 2_000,
    });

    this.pool.on('error', (err) => {
      console.error('[Lido][DatabaseService] Unexpected error on idle client', err);
    });
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private async ensureSchemaExists(client?: PoolClient): Promise<void> {
    if (this.schema === 'public') return;
    if (this.ensureSchemaPromise) return this.ensureSchemaPromise;

    this.ensureSchemaPromise = (async () => {
      const conn = client ?? (await this.pool.connect());
      const shouldRelease = client == null;

      try {
        await conn.query(`CREATE SCHEMA IF NOT EXISTS "${this.schema}"`);
      } finally {
        if (shouldRelease) conn.release();
      }
    })();

    return this.ensureSchemaPromise;
  }

  private async ensureSearchPath(client: PoolClient): Promise<void> {
    if (this.schema === 'public') return;
    if (this.configuredClients.has(client)) return;

    await this.ensureSchemaExists(client);
    await client.query(`SET search_path TO "${this.schema}", public`);
    this.configuredClients.add(client);
  }

  async getClient(): Promise<PoolClient> {
    const client = await this.pool.connect();
    try {
      await this.ensureSearchPath(client);
      return client;
    } catch (error) {
      client.release();
      throw error;
    }
  }

  async query(text: string, params?: any[]): Promise<QueryResult<any>> {
    const start = Date.now();
    const client = await this.getClient();
    try {
      const result = await client.query(text, params);
      const duration = Date.now() - start;

      if (duration > 1000) {
        console.warn('[Lido][DatabaseService] Slow query', { durationMs: duration, query: text.slice(0, 120) });
      }

      return result;
    } catch (error) {
      console.error('[Lido][DatabaseService] Query error', { query: text, params, error });
      throw error;
    } finally {
      client.release();
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('[Lido][DatabaseService] Connection check failed', error);
      return false;
    }
  }

  async initializeSchema(): Promise<void> {
    const schemaPath = path.join(__dirname, '../../../schema.sql');
    if (!fs.existsSync(schemaPath)) {
      console.warn('[Lido][DatabaseService] schema.sql not found, skipping initialization');
      return;
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    await this.query(schema);
    console.log(`[Lido][DatabaseService] ✅ Schema initialized (schema=${this.schema})`);
  }

  async close(): Promise<void> {
    await this.pool.end();
    console.log('[Lido][DatabaseService] Connection pool closed');
  }
}

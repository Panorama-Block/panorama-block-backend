import { Pool, PoolClient, QueryResult } from 'pg';
import fs from 'fs';
import path from 'path';

export class DatabaseService {
  private static instance: DatabaseService;
  private pool: Pool;

  private constructor() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required in .env file!');
    }

    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('[DatabaseService] Unexpected error on idle client', err);
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Get a client from the pool
   */
  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  /**
   * Execute a query
   */
  async query(text: string, params?: any[]): Promise<QueryResult<any>> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      if (duration > 1000) {
        console.warn(`[DatabaseService] Slow query (${duration}ms):`, text.substring(0, 100));
      }

      return result;
    } catch (error) {
      console.error('[DatabaseService] Query error:', error);
      console.error('[DatabaseService] Query:', text);
      console.error('[DatabaseService] Params:', params);
      throw error;
    }
  }

  /**
   * Execute a transaction
   */
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

  /**
   * Initialize database schema
   */
  async initializeSchema(): Promise<void> {
    console.log('[DatabaseService] Initializing database schema...');

    const schemaPath = path.join(__dirname, '../../schema.sql');

    if (!fs.existsSync(schemaPath)) {
      console.warn('[DatabaseService] schema.sql not found, skipping initialization');
      return;
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');

    try {
      await this.query(schema);
      console.log('[DatabaseService] ✅ Database schema initialized successfully');
    } catch (error) {
      console.error('[DatabaseService] ❌ Failed to initialize schema:', error);
      throw error;
    }
  }

  /**
   * Check database connection
   */
  async checkConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      console.log('[DatabaseService] ✅ Database connection successful');
      return true;
    } catch (error) {
      console.error('[DatabaseService] ❌ Database connection failed:', error);
      return false;
    }
  }

  /**
   * Create the database if it doesn't exist
   */
  static async createDatabaseIfNotExists(): Promise<void> {
    const dbName = process.env.DB_NAME || 'panorama_dca';
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '5433');
    const user = process.env.DB_USER || 'postgres';
    const password = process.env.DB_PASSWORD || 'postgres';

    // Connect to postgres database to create our database
    const tempPool = new Pool({
      host,
      port,
      user,
      password,
      database: 'postgres', // Connect to default postgres database
    });

    try {
      // Check if database exists
      const result = await tempPool.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        [dbName]
      );

      if (result.rows.length === 0) {
        console.log(`[DatabaseService] Creating database: ${dbName}`);
        await tempPool.query(`CREATE DATABASE ${dbName}`);
        console.log(`[DatabaseService] ✅ Database ${dbName} created successfully`);
      } else {
        console.log(`[DatabaseService] Database ${dbName} already exists`);
      }
    } catch (error) {
      console.error('[DatabaseService] Error creating database:', error);
      throw error;
    } finally {
      await tempPool.end();
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this.pool.end();
    console.log('[DatabaseService] Connection pool closed');
  }
}

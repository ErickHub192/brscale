/**
 * PostgreSQL Checkpoint Saver for LangGraph
 * Enables workflow state persistence and recovery
 */

import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { Pool, PoolConfig } from 'pg';
import { env } from '@/infrastructure/config/env';

/**
 * PostgreSQL Connection Pool
 * Shared pool for LangGraph checkpointing
 */
let pgPool: Pool | null = null;

/**
 * Get or create PostgreSQL connection pool
 */
export function getPostgresPool(): Pool {
  if (!pgPool) {
    const poolConfig: PoolConfig = {
      connectionString: env.SUPABASE_CONNECTION_STRING,
      // Connection pool settings
      max: 20, // Maximum number of clients (increased for concurrent workflows)
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Wait up to 10 seconds for connection
      statement_timeout: 30000, // 30 second timeout for queries
    };

    pgPool = new Pool(poolConfig);

    // Handle pool errors
    pgPool.on('error', (err) => {
      console.error('[PostgresPool] Unexpected error on idle client:', err);
    });

    console.log('[PostgresPool] PostgreSQL connection pool created');
  }

  return pgPool;
}

/**
 * PostgreSQL Checkpoint Saver instance
 * LangGraph uses this to persist and recover workflow state
 */
let checkpointSaver: PostgresSaver | null = null;

/**
 * Get or create PostgreSQL checkpoint saver
 */
export async function getCheckpointSaver(): Promise<PostgresSaver> {
  if (!checkpointSaver) {
    const pool = getPostgresPool();

    // Create PostgresSaver instance
    checkpointSaver = new PostgresSaver(pool);

    // Setup checkpoint tables (creates if not exists)
    // LangGraph automatically creates:
    // - checkpoints (workflow state snapshots)
    // - checkpoint_blobs (large binary data)
    // - checkpoint_writes (pending writes)
    await checkpointSaver.setup();

    console.log('[CheckpointSaver] PostgreSQL checkpoint saver initialized');
    console.log('[CheckpointSaver] Tables: checkpoints, checkpoint_blobs, checkpoint_writes');
  }

  return checkpointSaver;
}

/**
 * Close PostgreSQL pool gracefully
 * Call this during application shutdown
 */
export async function closePostgresPool(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
    checkpointSaver = null;
    console.log('[PostgresPool] Connection pool closed');
  }
}

/**
 * Health check for PostgreSQL connection
 */
export async function checkPostgresHealth(): Promise<boolean> {
  try {
    const pool = getPostgresPool();
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('[PostgresPool] Health check failed:', error);
    return false;
  }
}

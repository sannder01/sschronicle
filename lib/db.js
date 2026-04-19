// lib/db.js
// Singleton pool — reused across hot-reloads in dev
import { Pool } from 'pg';

const globalForPg = globalThis;

// ИСПРАВЛЕНО: SSL включаем только если DATABASE_URL не указывает на localhost
function getSslConfig() {
  const url = process.env.DATABASE_URL || '';
  if (url.includes('localhost') || url.includes('127.0.0.1')) return false;
  return { rejectUnauthorized: false };
}

const pool = globalForPg._pgPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: getSslConfig(),
  max: 10,
});

if (process.env.NODE_ENV !== 'production') {
  globalForPg._pgPool = pool;
}

/**
 * Execute a parameterised query.
 * @param {string} text  - SQL string with $1, $2 placeholders
 * @param {any[]}  params
 */
export async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  if (process.env.NODE_ENV === 'development') {
    const ms = Date.now() - start;
    if (ms > 300) console.warn(`⚠️  Slow query (${ms}ms):`, text.slice(0, 80));
  }
  return result;
}

export { pool };

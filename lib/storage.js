'use strict';

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL wajib diatur sebelum menjalankan situs.');

const pool = new Pool({
  connectionString: DATABASE_URL,
  connectionTimeoutMillis: 5000
});
pool.on('error', (error) => console.error(`[PostgreSQL] ${error.message}`));

async function readState(keys) {
  const result = await pool.query(
    'SELECT key, value FROM app_state WHERE key = ANY($1::text[])',
    [keys]
  );
  const state = Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
  const missing = keys.filter((key) => !Object.hasOwn(state, key));
  if (missing.length) {
    const error = new Error(`Data ${missing.join(', ')} belum diimpor ke PostgreSQL.`);
    error.status = 503;
    throw error;
  }
  return state;
}

async function updateState(keys, update) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT key, value FROM app_state WHERE key = ANY($1::text[]) ORDER BY key FOR UPDATE',
      [keys]
    );
    const state = Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
    const missing = keys.filter((key) => !Object.hasOwn(state, key));
    if (missing.length) {
      const error = new Error(`Data ${missing.join(', ')} belum diimpor ke PostgreSQL.`);
      error.status = 503;
      throw error;
    }
    const resultValue = update(state);
    for (const key of keys) {
      await client.query(
        'UPDATE app_state SET value = $2::jsonb, updated_at = NOW() WHERE key = $1',
        [key, JSON.stringify(state[key])]
      );
    }
    await client.query('COMMIT');
    return resultValue;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(`[PostgreSQL] Gagal membatalkan transaksi: ${rollbackError.message}`);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function verifyState() {
  await readState(['berita', 'komentar', 'site-settings', 'dokumentasi']);
}

module.exports = { pool, readState, updateState, verifyState };

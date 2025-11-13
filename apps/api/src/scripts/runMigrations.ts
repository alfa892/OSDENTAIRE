import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import 'dotenv/config';

const migrationsDir = path.resolve(__dirname, '../../drizzle');

const loadSqlFiles = () => {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => ({
      name: path.parse(file).name,
      sql: fs.readFileSync(path.join(migrationsDir, file), 'utf8'),
    }));
};

const connectionString = process.env.DATABASE_URL;

const pool = new Pool(
  connectionString
    ? { connectionString }
    : {
        host: process.env.PGHOST ?? 'localhost',
        port: Number(process.env.PGPORT ?? 5432),
        user: process.env.PGUSER ?? 'postgres',
        password: process.env.PGPASSWORD ?? 'postgres',
        database: process.env.PGDATABASE ?? 'osdentaire',
      }
);

(async () => {
  const client = await pool.connect();
  try {
    await client.query(
      'CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY, executed_at TIMESTAMPTZ NOT NULL DEFAULT now())'
    );

    const applied = await client.query<{ name: string }>('SELECT name FROM app_migrations ORDER BY name');
    const appliedSet = new Set<string>(applied.rows.map((row: { name: string }) => row.name));

    const files = loadSqlFiles();
    for (const file of files) {
      if (appliedSet.has(file.name)) {
        continue;
      }

      console.log(`Applying migration ${file.name}`);
      await client.query('BEGIN');
      try {
        await client.query(file.sql);
        await client.query('INSERT INTO app_migrations(name) VALUES($1)', [file.name]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Migration ${file.name} failed`, error);
        throw error;
      }
    }

    console.log('Migrations applied');
  } finally {
    client.release();
    await pool.end();
  }
})().catch((error) => {
  console.error('Migration run aborted', error);
  process.exit(1);
});

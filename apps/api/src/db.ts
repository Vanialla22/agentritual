import { createClient, type Client } from "@libsql/client";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config";

/**
 * Minimal async DB interface shared by the local SQLite adapter
 * (node:sqlite, built into Node >= 22) and the Turso adapter
 * (@libsql/client). The API never issues UPDATE/DELETE against
 * audit_log — it is append-only by design.
 */
export interface Db {
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

function normalizeRow(
  row: unknown,
  columns: string[],
): Record<string, unknown> {
  if (Array.isArray(row)) {
    const out: Record<string, unknown> = {};
    columns.forEach((c, i) => {
      out[c] = row[i];
    });
    return out;
  }
  return row as Record<string, unknown>;
}

class LocalDb implements Db {
  private db: DatabaseSync;

  constructor(filePath: string) {
    const dir = path.dirname(filePath);
    if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(filePath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
  }

  async run(sql: string, params: unknown[] = []) {
    const info = this.db.prepare(sql).run(...(params as never[]));
    return { changes: Number(info.changes) };
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...(params as never[])) as T[];
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return this.db.prepare(sql).get(...(params as never[])) as T | undefined;
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

class TursoDb implements Db {
  private client: Client;

  constructor(url: string, authToken: string) {
    this.client = createClient({ authToken, url });
  }

  async run(sql: string, params: unknown[] = []) {
    const rs = await this.client.execute({ args: params as never[], sql });
    return { changes: rs.rowsAffected };
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const rs = await this.client.execute({ args: params as never[], sql });
    return rs.rows.map((r) => normalizeRow(r, rs.columns)) as T[];
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const rows = await this.all<T>(sql, params);
    return rows[0];
  }

  async exec(sql: string): Promise<void> {
    await this.client.execute(sql);
  }

  async close(): Promise<void> {
    this.client.close();
  }
}

let instance: Db | null = null;

export function getDb(): Db {
  if (!instance) {
    instance = config.tursoUrl
      ? new TursoDb(config.tursoUrl, config.tursoAuthToken)
      : new LocalDb(config.databasePath);
  }
  return instance;
}

/** Apply every *.sql migration in order, skipping already-applied ones. */
export async function migrate(db: Db): Promise<string[]> {
  const candidates = [
    path.join(__dirname, "..", "migrations"),
    path.join(__dirname, "..", "..", "migrations"),
    path.join(process.cwd(), "migrations"),
    path.join(process.cwd(), "apps", "api", "migrations"),
  ];
  const dir = candidates.find((c) => fs.existsSync(c));
  if (!dir) throw new Error("migrations directory not found");
  const applied: string[] = [];
  await db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const done = await db.all<{ name: string }>("SELECT name FROM _migrations");
  const doneSet = new Set(done.map((r) => r.name));
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (doneSet.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    await db.exec(sql);
    await db.run(
      "INSERT INTO _migrations (name, applied_at) VALUES (?, ?)",
      [file, new Date().toISOString()],
    );
    applied.push(file);
  }
  return applied;
}

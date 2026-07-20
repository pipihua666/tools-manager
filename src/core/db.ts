import { Database } from "bun:sqlite";
import { paths } from "./paths";
import { ensureDir } from "./fs";

export type SkillRow = {
  id: number;
  name: string;
  description: string | null;
  path: string;
  source_type: string;
  source_url: string | null;
  source_ref: string | null;
  source_subpath: string | null;
  source_commit: string | null;
  created_at: string;
  updated_at: string;
};

export type PresetRow = {
  id: number;
  name: string;
  created_at: string;
};

export type McpServerRow = {
  id: number;
  name: string;
  command: string;
  transport: string;
  url: string;
  args_json: string;
  env_json: string;
  headers_json: string;
  target_tools_json: string;
  enabled: number;
  created_at: string;
  updated_at: string;
};

let database: Database | null = null;

export async function openDb(): Promise<Database> {
  if (database) return database;
  const p = paths();
  await ensureDir(p.root);
  database = new Database(p.dbPath);
  database.exec("PRAGMA journal_mode = WAL");
  migrate(database);
  ensureDefaultPreset(database);
  return database;
}

export function closeDb(): void {
  database?.close();
  database = null;
}

function migrate(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      path TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_url TEXT,
      source_ref TEXT,
      source_subpath TEXT,
      source_commit TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS preset_skills (
      preset_id INTEGER NOT NULL,
      skill_id INTEGER NOT NULL,
      PRIMARY KEY (preset_id, skill_id),
      FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mcp_servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      command TEXT NOT NULL,
      transport TEXT NOT NULL DEFAULT 'stdio',
      url TEXT NOT NULL DEFAULT '',
      args_json TEXT NOT NULL,
      env_json TEXT NOT NULL,
      headers_json TEXT NOT NULL DEFAULT '{}',
      target_tools_json TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  addColumnIfMissing(db, "mcp_servers", "transport", "TEXT NOT NULL DEFAULT 'stdio'");
  addColumnIfMissing(db, "mcp_servers", "url", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "mcp_servers", "headers_json", "TEXT NOT NULL DEFAULT '{}'");
}

function addColumnIfMissing(db: Database, table: string, column: string, definition: string): void {
  const columns = db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function ensureDefaultPreset(db: Database): void {
  db.query("INSERT OR IGNORE INTO presets (name) VALUES (?)").run("Default");
}

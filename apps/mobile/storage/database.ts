import * as SQLite from "expo-sqlite";

const databasePromise = SQLite.openDatabaseAsync("solana-android-hub.db");

export interface LocalInstallRecord {
  packageName: string;
  appId: string;
  slug: string;
  appName: string;
  releaseId: string;
  versionCode: string;
  versionName: string;
  certificateSha256: string;
  permissions: readonly string[];
  installedAt: number;
}

export type CatalogChannel = "trusted" | "approved";

export async function initializeLocalDatabase(): Promise<void> {
  const database = await databasePromise;
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS installed_apps (
      package_name TEXT PRIMARY KEY NOT NULL,
      app_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      app_name TEXT NOT NULL,
      release_id TEXT NOT NULL,
      version_code TEXT NOT NULL,
      version_name TEXT NOT NULL,
      certificate_sha256 TEXT NOT NULL,
      permissions_json TEXT NOT NULL,
      installed_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS install_operations (
      operation_id TEXT PRIMARY KEY NOT NULL,
      package_name TEXT NOT NULL,
      status TEXT NOT NULL,
      detail TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
}

export async function getCatalogChannel(): Promise<CatalogChannel> {
  const database = await databasePromise;
  await initializeLocalDatabase();
  const row = await database.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'catalog_channel'");
  return row?.value === "approved" ? "approved" : "trusted";
}

export async function setCatalogChannel(channel: CatalogChannel): Promise<void> {
  const database = await databasePromise;
  await initializeLocalDatabase();
  await database.runAsync(
    "INSERT INTO settings (key, value) VALUES ('catalog_channel', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    channel
  );
}

export async function saveInstalledApp(record: LocalInstallRecord): Promise<void> {
  const database = await databasePromise;
  await initializeLocalDatabase();
  await database.runAsync(
    `INSERT INTO installed_apps (
      package_name, app_id, slug, app_name, release_id, version_code, version_name,
      certificate_sha256, permissions_json, installed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(package_name) DO UPDATE SET
      app_id = excluded.app_id, slug = excluded.slug, app_name = excluded.app_name,
      release_id = excluded.release_id, version_code = excluded.version_code,
      version_name = excluded.version_name, certificate_sha256 = excluded.certificate_sha256,
      permissions_json = excluded.permissions_json, installed_at = excluded.installed_at`,
    record.packageName,
    record.appId,
    record.slug,
    record.appName,
    record.releaseId,
    record.versionCode,
    record.versionName,
    record.certificateSha256,
    JSON.stringify(record.permissions),
    record.installedAt
  );
}

export async function listInstalledApps(): Promise<readonly LocalInstallRecord[]> {
  const database = await databasePromise;
  await initializeLocalDatabase();
  const rows = await database.getAllAsync<{
    package_name: string;
    app_id: string;
    slug: string;
    app_name: string;
    release_id: string;
    version_code: string;
    version_name: string;
    certificate_sha256: string;
    permissions_json: string;
    installed_at: number;
  }>("SELECT * FROM installed_apps ORDER BY app_name COLLATE NOCASE");
  return rows.map((row) => ({
    packageName: row.package_name,
    appId: row.app_id,
    slug: row.slug,
    appName: row.app_name,
    releaseId: row.release_id,
    versionCode: row.version_code,
    versionName: row.version_name,
    certificateSha256: row.certificate_sha256,
    permissions: parsePermissions(row.permissions_json),
    installedAt: row.installed_at
  }));
}

function parsePermissions(value: string): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

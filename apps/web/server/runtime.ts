import { parseHubConfig } from "@hub/config";
import { connectDatabase } from "@hub/database";

export const hubConfig = parseHubConfig(process.env);

const localDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export const database = connectDatabase(
  hubConfig.databaseUrl ?? (hubConfig.appEnvironment === "local" ? localDatabaseUrl : missingDatabaseUrl())
);

function missingDatabaseUrl(): never {
  throw new Error("DATABASE_URL is required outside local development");
}

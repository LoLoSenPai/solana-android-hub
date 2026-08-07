import postgres, { type Sql } from "postgres";

export type HubSql = Sql;

export function connectDatabase(databaseUrl: string): HubSql {
  return postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    transform: { undefined: null }
  });
}

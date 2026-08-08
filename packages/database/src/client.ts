import postgres, { type Sql } from "postgres";

export type HubSql = Sql;

export function connectDatabase(databaseUrl: string): HubSql {
  return postgres(databaseUrl, {
    // Keep each warm serverless instance small. Supavisor multiplexes these
    // connections, while local development still has enough concurrency for
    // the catalogue and publisher flows.
    max: 3,
    idle_timeout: 10,
    connect_timeout: 10,
    max_lifetime: 300,
    prepare: false,
    transform: { undefined: null }
  });
}

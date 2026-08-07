# ADR-002 — Next.js is the only remote data boundary

## Decision

Next.js route handlers and server services are the only browser/mobile boundary. They connect directly to a private Supabase Postgres schema and call Helius server-side.

## Reason

This prevents database and RPC credentials from reaching clients and centralizes trust policy.

## Alternatives rejected

- Direct Supabase/Helius clients: exposes infrastructure and duplicates policy.
- Additional microservices: not required for the initial volume.

## Consequences

The Supabase Data API is not used for Hub tables. Server failures are explicit rather than silently falling back to client-side data.

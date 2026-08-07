# ADR-003 — Wallet Standard signed-message sessions

## Decision

Authenticate publishers with a one-time, domain/environment-bound Wallet Standard Ed25519 message. Store opaque hashed sessions in Postgres.

## Reason

No private key, seed phrase, transaction, or Supabase Auth account is required.

## Alternatives rejected

- NFT ownership alone: not publishing authority.
- A transaction-based login: unnecessary cost and signing risk.
- Combining login with distribution consent: obscures intent and auditability.

## Consequences

V1 supports authorities capable of off-chain Ed25519 signing. Multisig/smart-account authorization requires a future explicit provider.

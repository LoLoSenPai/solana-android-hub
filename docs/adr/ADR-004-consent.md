# ADR-004 — Canonical, environment-bound distribution consent

## Decision

Use the canonical message in `@hub/domain`, with app mint, scopes, policy, origin, environment, network, timestamps, nonce, and terms version.

## Reason

Consent must be explicit, replay-resistant, auditable, and impossible to promote from staging to production.

## Alternatives rejected

- Checkbox-only consent: no cryptographic publisher proof.
- Reusing login signatures: conflates identity and authorization.

## Consequences

Changing release policy requires a replacement signature. No real production consent is collected before the production origin and terms are final.

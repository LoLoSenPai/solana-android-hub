# ADR-001 — TypeScript monorepo

## Decision

Use pnpm workspaces and Turborepo with `apps/web`, `apps/mobile`, and small shared packages. Keep Kotlin inside a local Expo module.

## Reason

The web API, Android client, chain adapters, and trust rules need shared DTOs without coupling their runtimes.

## Alternatives rejected

- Independent repositories: unnecessary version and contract drift.
- A single Next.js package: cannot contain the Android native boundary cleanly.

## Consequences

Workspace package APIs stay narrow. Turbo coordinates checks but does not become runtime infrastructure.

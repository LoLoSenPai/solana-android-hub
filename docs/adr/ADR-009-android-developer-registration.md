# ADR-009 — Android developer registration is a future provider

## Decision

Android developer-registration verification is not a V1 development or local/staging launch gate. No registration table, publisher workflow, or substantial UI is implemented.

Shared DTOs remain versionable and a future `AndroidDeveloperRegistrationProvider` may be introduced when Android's global enforcement details materially affect the standalone distribution flow.

## Consequences

- Registration state is absent/null in V1 and cannot be mistaken for any of the four mandatory trust facts.
- Production hardening must reassess the requirement before the relevant 2027 enforcement window.
- Provider work begins only from published platform requirements and cannot silently become an APK-authenticity substitute.

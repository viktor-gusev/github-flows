# Usage Rules

## Structural Rules

- The host application may register at most one `Github_Flows_Event_Attribute_Provider` through `Github_Flows_Event_Attribute_Provider_Holder$`.
- The holder stores provider identity only; it must not store per-event results.
- Additional event attributes are optional inputs to package-owned profile selection.
- Effective-profile selection remains package-owned and deterministic.

## Provider Rules

- The provider must implement `getAttributes({headers, loggingContext, payload})`.
- The provider must return additional plain attribute values only.
- The provider must not return `allow`, `deny`, or any equivalent execution decision.
- The provider must not override package-owned base attribute names such as `event`, `repository`, or `action`.
- The provider should be registered during startup before the web server begins processing requests.

## DI Rules

- The package is designed for `@teqfw/di`.
- Host code should resolve `Github_Flows_*` modules through DI rather than constructing package internals manually.
- Runtime configuration should be supplied through `Github_Flows_Config_Runtime__Factory$` during startup only.
- Provider registration should be performed through `Github_Flows_Event_Attribute_Provider_Holder$`, not through runtime DTO mutation.

## Decision Boundary

- The host may contribute attributes.
- The package decides whether one event yields one effective profile.
- Events with no selected profile are skipped by the package.
- Host-provided attributes must not turn the package into a host-controlled validation engine.

## State Rules

- Each event is evaluated independently.
- The package must not rely on cross-event in-memory state for selection.
- Host providers should treat returned attributes as event-scoped data only.

## Logging Boundary

- Event attribute enrichment is observable in package logging.
- Logging does not become a decision input.
- Provider registration and provider output should be treated as configuration and event-processing concerns, not as runtime orchestration state.

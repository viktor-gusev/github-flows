# Usage Rules

- Path: `ai/rules.md`
- Version: `20260419`

## Structural Rules

- The host may register at most one `Github_Flows_Event_Attribute_Provider`.
- The provider is optional.
- The provider returns host-provided additional event attributes only.
- The package decides whether an admitted event yields one effective execution profile.

## Provider Rules

- The provider must expose `getAttributes({eventModel, headers, loggingContext, payload})`.
- The provider must not return `allow`, `deny`, or any equivalent execution decision.
- The provider must not override package-owned base event attributes.
- The provider should prefer `eventModel` for package-owned base attributes.
- The provider may use raw `payload` for business-specific GitHub event facts outside the normalized package-owned model.
- The provider should be registered during host startup before the web server begins serving requests.

## Runtime Rules

- Host code should configure `Github_Flows_Config_Runtime` during startup only.
- Host code should resolve `Github_Flows_*` modules through DI rather than wiring internals manually.
- Events are evaluated independently.
- The package must not rely on cross-event state for selection.
- Canonical admitted-event archives remain under `workspaceRoot/log/run/{owner}/{repo}/{eventId}/`.
- Observational indexes under `workspaceRoot/log/index/` are derivative navigation views only.

## Boundary Rules

- The host may contribute additional event attributes.
- The package owns selection and launch permission.
- Events with no selected profile are skipped.
- The package does not become a host-controlled validation engine.

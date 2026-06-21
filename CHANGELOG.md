# Changelog

All notable changes to `@teqfw/github-flows` will be documented in this file.

## 0.7.0 - 2026-06-21 - Optional startup scripts and host-side prelaunch support

Release focused on separating host-side startup preparation from container-side preparation and aligning the public contract with the implemented runtime model.

### Added

- optional `hostScript` support in execution runtime profiles and launch contracts for host-side prelaunch preparation before Docker startup;
- unit coverage for host-side startup execution, timeout budget carry-over, early failure handling, and optional startup-script omission;
- validator-clean execution start coordinator source under TeqFW ESM rules.

### Changed

- `setupScript` is now optional in the resolved launch contract and Docker runtime path instead of being treated as mandatory startup input;
- runtime startup now spends one shared timeout budget across optional host-side preparation, container-side preparation, and handler launch;
- public type declarations and published docs now describe `hostScript` and `setupScript` as optional runtime fields consistently;
- package version metadata was updated to `0.7.0`.

## 0.6.0 - 2026-06-10 - Structured prompt variables and release alignment

Release focused on structured prompt-variable declarations, compatibility-preserving prompt materialization behavior, and documentation alignment across the package surfaces.

### Added

- support for structured `promptVariables` with `required` and `optional` groups, while preserving legacy flat required-only maps as compatibility input;
- optional prompt-binding defaults, including normalization of `null` defaults into empty strings for prompt text;
- unit coverage for structured prompt bindings, optional omission, optional defaults, `null` default normalization, and mixed-format rejection.

### Changed

- published `README.md`, `docs/`, and `ai/` documentation now describe the structured prompt-variable format and its compatibility behavior consistently;
- runtime prompt materialization now distinguishes required prompt bindings from optional prompt bindings instead of treating every declared binding as mandatory;
- package version metadata was updated to `0.6.0`.

## 0.5.0 - 2026-05-28 - Trigger-array profile resolution coverage

Release focused on end-to-end verification of trigger-array profile resolution and effective-profile selection through the real webhook flow.

### Added

- integration coverage for scalar trigger matching, `actorLogin` trigger arrays, host-provided trigger arrays, and multi-attribute trigger-array combinations through webhook ingress;
- integration assertions for persisted event artifacts, including `event.json`, `effective-profile.json`, `prompt-bindings.json`, and event-scoped decision logs;
- stronger runtime command assertions covering repository cache sync, workspace preparation, and Docker launch behavior in positive and negative flows.

### Changed

- trigger-array profile resolution coverage now verifies hierarchical merge before expansion, empty-array no-match handling, and deterministic candidate-selection precedence through the composed runtime path;
- package version metadata was updated to `0.5.0`.

## 0.4.0 - 2026-05-20

Release focused on execution-start hardening, repository-cache synchronization safety, and prompt binding expansion.

### Added

- repository-cache synchronization locking with bounded wait, stale-lock recovery, and recreation coverage for pull refresh failures;
- support for prompt-variable bindings from same-event host-provided attributes under `host.*`, alongside `event.*` and `workspace.*`;
- integration coverage for accepted webhook execution, host-backed prompt bindings, and rejection of agent profiles without `promptRef`;
- unit coverage for repository-cache locking, runtime lock configuration, host-backed prompt binding resolution, and enriched webhook failure paths.

### Changed

- runtime execution contracts now consistently assume Docker as the only supported execution boundary;
- agent execution is rejected before preparation side effects when the selected profile does not expose `execution.handler.promptRef`;
- webhook failure handling now records execution failures explicitly in the event-scoped processing log;
- published `README.md`, `docs/`, and `ai/` documentation now align on `host.*` prompt bindings, prompt materialization rules, and provider responsibilities;
- development dependencies and lockfile state were refreshed after `npm update`, including npm-sourced `@teqfw/di` and newer `@types/node` / `undici-types` entries.

## 0.3.0 - 2026-04-21

Release focused on admitted-event normalization and published package guidance.

### Added

- canonical admitted-event model construction with package-owned base attributes `event`, `repository`, `action`, and optional `actorLogin`;
- explicit `Github_Flows_Event_Model_Builder` package component and public TypeScript declarations for the admitted-event model;
- human-facing package documentation under `docs/` for overview, single-event setup, profile layout, event attributes, and event chains;
- unit and integration coverage for admitted-event model construction, attribute resolution, webhook handling, and ingress behavior.

### Changed

- `Github_Flows_Event_Attribute_Provider` now receives `getAttributes({ eventModel, headers, loggingContext, payload })`, where `eventModel` is the preferred source for package-owned base attributes and `payload` remains available for business-specific GitHub facts;
- webhook handling now builds the admitted-event model before logging-context creation and profile matching, so event-scoped logging and attribute resolution use one canonical package-owned event shape;
- event logging context now derives repository identity, event type, and delivery-based event id from the admitted-event model;
- published `README.md`, `docs/`, and `ai/` documentation now use the same terminology for package-owned base attributes versus host-provided additional event attributes.

## 0.2.0 - 2026-04-19

Release focused on repository-scoped event traceability and host-side Git authentication.

### Added

- non-interactive Git authentication for repository cache synchronization and workspace preparation using host-provided `GH_TOKEN` or `GITHUB_TOKEN`;
- observational log indexes under `workspaceRoot/log/index/` for navigation by event type, action, and user-facing object number.

### Changed

- canonical admitted-event archival logs now use `workspaceRoot/log/run/{owner}/{repo}/{eventId}/`;
- release publication workflow now runs the full test suite, validates release-tag version alignment, and checks npm publication state before publishing;
- package documentation now describes the current runtime configuration and event-log navigation model more accurately.

## 0.1.1 - 2026-04-10

Release focused on execution traceability and launch flow refinement.

### Added

- execution pipeline logging across admission, preparation, and runtime stages;
- execution start coordination with clearer launch-phase sequencing;
- runtime stdout and stderr streaming into the execution log;
- execution workspace preparation and prompt materialization steps;
- Docker-based execution runtime support;
- launch contract and execution-profile alignment across the preparation pipeline.

### Changed

- candidate-profile resolution now scans the full `cfg/` hierarchy for profile fragments;
- release documentation and package metadata were brought in sync with the current codebase state.

## 0.1.0 - 2026-04-10

Initial public release of the package.

### Added

- fixed GitHub webhook ingress at `/webhooks/github`;
- package-owned event attribute resolution and profile selection;
- optional host-provided event-attribute provider boundary;
- host-started web server component;
- public agent-facing documentation under `ai/`;
- public human-facing overview in `README.md`.

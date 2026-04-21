# Changelog

All notable changes to `@teqfw/github-flows` will be documented in this file.

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

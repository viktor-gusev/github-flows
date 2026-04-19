# Changelog

All notable changes to `@teqfw/github-flows` will be documented in this file.

## 0.2.0 - 2026-04-19

Release focused on execution observability and repository automation alignment.

### Added

- observational log indexes for webhook execution traces;
- richer execution workspace preparation coverage for prompt materialization;
- updated release metadata to reflect the current package state.

### Changed

- archival logging now omits event type from the stored path;
- GitHub Actions publishing flow now uses the current npm scenario;
- Git authentication in automation now uses the environment-provided token;
- cache and preparation pipelines were refined to match the current execution model.

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

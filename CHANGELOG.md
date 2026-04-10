# Changelog

All notable changes to `@teqfw/github-flows` will be documented in this file.

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

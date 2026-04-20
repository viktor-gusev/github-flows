# Human Documentation

- Path: `docs/AGENTS.md`
- Version: `20260420`

## Purpose

This directory contains the public human-facing documentation for `@teqfw/github-flows`.

## Reading Order

Read the documents in this order:

1. `overview.md` for the package role, scope, and core mental model.
2. `single-event-launch.md` for configuring one agent run for one GitHub event.
3. `profile-layout.md` for organizing `workspaceRoot/cfg/` and profile fragments.
4. `event-attributes.md` for base and host-provided matching inputs.
5. `event-chains.md` for designing multi-step automation through independent GitHub repository events.

## Level Map

- `AGENTS.md` — level definition for `docs/`.
- `event-attributes.md` — matching inputs and host-provided attributes.
- `event-chains.md` — multi-step automation through independent repository events.
- `overview.md` — package identity, boundaries, and document navigation.
- `profile-layout.md` — profile-fragment structure, layout, and selection model.
- `single-event-launch.md` — one-event configuration walkthrough.

## Scope

This directory documents the supported user-facing package model:

- one admitted event is evaluated independently
- zero or one effective profile may be selected for that event
- at most one execution may start from that event

This directory does not define:

- private development context
- internal implementation details
- agent-facing integration guidance
- host runtime internals beyond what is needed for user understanding

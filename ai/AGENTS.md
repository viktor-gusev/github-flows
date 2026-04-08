# AGENTS.md

Version: 20260408

## Package Purpose

This directory provides the Agent Interface of `@teqfw/github-flows`. It contains a compact consumer-facing projection of the package intended for LLM agents and host applications that use the package as a dependency inside TeqFW systems.

The interface explains how external code should compose the package, how to register a host-provided `Github_Flows_Event_Attribute_Provider`, and which runtime boundaries belong to the package versus the host application.

## TeqFW Usage Model

`@teqfw/github-flows` is designed for TeqFW-style runtime composition with `@teqfw/di`.

Dependencies should be linked through Canonical Dependency Codes and constructor injection rather than by manually wiring package internals. External code should treat the package as DI-managed infrastructure:

- host modules declare dependencies through `__deps__`;
- the container resolves `Github_Flows_*` identifiers at runtime;
- the host initializes runtime configuration and optional extensions during startup;
- the package receives GitHub webhook events through its fixed web handler and performs its own deterministic profile selection.

## Reading Order

Agents should read the documents in this directory in the following order:

1. `AGENTS.md` — overview of the agent interface and navigation.
2. `overview.md` — package role, intended usage boundary, and main entry points.
3. `abstractions.md` — core consumer-facing abstractions, including the event-attribute extension point.
4. `rules.md` — mandatory usage constraints and invariants.
5. `examples/event-attribute-provider.md` — minimal example of host-side provider registration.

## Interface Scope

The documents in this directory define only the supported usage semantics relevant to package consumers. Behaviors not described here should be treated as undefined and should not be inferred from internal implementation details.

Deep package internals and repository organization are outside the preferred consumer interface unless a task explicitly requires them.

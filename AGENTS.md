# Root Level

- Path: `AGENTS.md`
- Template Version: `20260327`

## Purpose

This root file defines the invariant rules of ADSM (Agent-Driven Software Management), establishes the roles of the Human and the Agent, specifies the resolution model of the cognitive context, and determines global operational constraints; it is read by the agent before any project-level instructions.

## Level Boundary

This level defines:

- ADSM invariants and principles
- interaction model between Human and Agent
- roles and responsibilities
- global execution constraints
- cognitive context resolution model
- rules of consistency between context and product
- repository separation rules
- AGENTS.md hierarchy and resolution model

This level does NOT define:

- project-specific logic
- domain-specific documentation
- implementation details of the product
- structure or rules inside `ctx/`
- task-specific instructions (they come from external prompts)

## ADSM Principles

### Project Spaces

A project consists of two interconnected spaces: the **Cognitive Context** (located in `./ctx/`) and the **Software Product** (all files outside `ctx/`); the context governs modifications of the product, and the product reflects application of the context.

The cognitive context may exist as a standalone repository but MUST be mounted under `./ctx/` for execution. The location `./ctx/` is the canonical execution location of the cognitive context.

### Interaction Model

The Human defines goals, maintains the context, and approves changes; the Agent interprets the context and modifies the product strictly within its boundaries; each iteration terminates with a report, whose structure and format are defined within the cognitive context.

## Roles

**Human:** defines goals, maintains context, approves modifications, evolves structure.  
**Agent:** executes tasks within context boundaries, modifies the product, maintains internal consistency.

## Context Resolution

Agent behavior is determined exclusively by documents of the cognitive context (located in `./ctx/`).

The entry point of the cognitive context is:

```
ctx/AGENTS.md
```

The external prompt defines the task but MUST be interpreted strictly within the cognitive context.

If a contradiction occurs between the prompt and the cognitive context, the cognitive context takes precedence.

The agent MUST interpret the prompt through the context before performing any action.

If the cognitive context (`./ctx/`) is missing, empty, or inaccessible, the agent MUST NOT perform any actions and MUST terminate with an execution error. The agent MAY report this error using any format permitted by the current interaction channel.

## Context vs Code Consistency

If a mismatch between the cognitive context (`./ctx/`) and the software product is detected, the context MUST be treated as the source of truth.

The agent MUST modify the product to match the context.

Modification of the context is allowed only if explicitly required by the task defined in the prompt.

## Repository Boundaries

The cognitive context (`./ctx/`) MAY be mounted from a separate repository.

In such cases, the context and the product MUST be treated as independent version-controlled spaces.

### Rules

- Changes in `./ctx/` MUST be committed and pushed to the context repository.
- Changes outside `./ctx/` MUST be committed and pushed to the product repository.
- The agent MUST NOT mix changes between these repositories.
- The agent MUST NOT remove, replace, or unmount the `./ctx/` directory.

Violation of these rules constitutes an execution error.

## AGENTS.md Hierarchy

If additional `AGENTS.md` files exist in subdirectories, they define local constraints within their directory level.

When executing a task in directory `X`, the working context of the agent is the aggregate of all `AGENTS.md` files along the path from the project root to `X`.

Rules:

- deeper levels override higher levels within their scope
- root-level invariants are mandatory and cannot be overridden
- all levels must form a coherent and non-contradictory system

## Compatibility

The root `AGENTS.md` defines methodological invariants and is reused across projects; project-specific rules are defined exclusively within the cognitive context (located in `./ctx/`).

## Change Policy

This file is a template-level definition and is not subject to modification within the project.

- The agent must not modify, replace, delete, or relocate this file
- The agent must not introduce changes that effectively alter its content or presence in the repository
- Updates to this file are performed only at the template level and propagated explicitly

Violation of these rules constitutes an execution error.

# Overview

`@teqfw/github-flows` is a TeqFW library for GitHub webhook driven agent execution.

It accepts GitHub webhooks on a fixed ingress, derives event attributes, resolves zero or one effective profile from `workspaceRoot/cfg/`, and starts at most one isolated execution for each admitted event.

This package is not a standalone application. The host application owns process lifecycle, runtime infrastructure, and startup orchestration.

## Mental Model

The package handles one event at a time:

`GitHub event -> event attributes -> matching profile -> launch contract -> one isolated run`

Important boundaries:

- one event may produce zero or one execution
- profile selection is deterministic and attribute-based
- prompt variables are applied after profile selection
- cross-event orchestration is outside the package

## Documentation Map

Use these guides in this order:

1. [single-event-launch.md](single-event-launch.md) for configuring one agent run for one GitHub event.
2. [profile-layout.md](profile-layout.md) for structuring `cfg/`, profile fragments, and matching logic.
3. [event-attributes.md](event-attributes.md) for available matching inputs and host-provided attributes.
4. [event-chains.md](event-chains.md) for designing multi-step automation as independent stages triggered by GitHub repository events.

## Typical Use

Use the package when you need:

- a fixed GitHub webhook ingress
- deterministic event-to-profile routing
- one isolated execution per admitted event
- host-controlled runtime and deployment

Do not use the package as:

- a workflow engine
- a cross-event state machine
- a standalone GitHub bot application

## Runtime Entry Points

The public package surface starts with:

- `Github_Flows_Config_Runtime`
- `Github_Flows_Event_Attribute_Provider_Holder`
- `Github_Flows_Web_Server`
- `Github_Flows_Web_Handler_Webhook`

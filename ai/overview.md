# Package Overview

- Path: `ai/overview.md`
- Version: `20260410`

## Purpose

Summarizes the public role of `@teqfw/github-flows` for agents and host applications.

## Package Role

`@teqfw/github-flows` is a TeqFW library that:

- exposes a fixed GitHub webhook ingress at `/webhooks/github`;
- admits webhook events for package-owned evaluation;
- may request additional event attributes from the host for the current admitted event;
- resolves zero or one effective execution profile;
- delegates the permitted execution to the host runtime boundary.

## Public Entry Points

- `Github_Flows_Config_Runtime$` for runtime configuration.
- `Github_Flows_Event_Attribute_Provider_Holder$` for optional host registration of one provider.
- `Github_Flows_Web_Server$` for starting the HTTP ingress.
- `Github_Flows_Web_Handler_Webhook$` for the public webhook handler surface.

## Usage Boundary

Use the package when a host application needs GitHub-driven execution startup inside a TeqFW system.

Do not treat the package as a standalone app, workflow engine, or host-controlled execution decision layer.


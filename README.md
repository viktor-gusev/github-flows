# github-flows

`@teqfw/github-flows` is a TeqFW library that exposes a fixed GitHub webhook ingress and starts at most one isolated execution for each admitted event.

It is not a standalone application. The host application owns process lifecycle, runtime infrastructure, and startup orchestration.

If you want a ready-to-run web server application built on top of this package, see [github-flows-app](https://github.com/flancer32/github-flows-app). That application provides the runtime wrapper around this package and may add extra services or host-level behavior.

This package is the base functionality. Wrappers can extend it with additional runtime services, deployment behavior, or other host-specific features without changing the package boundary.

## Public Surface

- `Github_Flows_Config_Runtime` for package runtime configuration.
- `Github_Flows_Event_Attribute_Provider_Holder` for one optional host-provided event-attribute provider.
- `Github_Flows_Web_Server` for starting the HTTP ingress surface.
- `Github_Flows_Web_Handler_Webhook` for the public webhook handler surface.

## Package Scope

The package:

- accepts GitHub webhook requests only on `/webhooks/github`;
- derives package-owned event attributes;
- may ask the host for additional event attributes for the current admitted event;
- resolves candidate profiles from `workspaceRoot/cfg/`;
- selects zero or one effective execution profile;
- delegates the permitted execution to the host runtime boundary;
- records event-scoped archival logs under `workspaceRoot/log/run/{owner}/{repo}/{eventId}/`;
- builds observational log indexes under `workspaceRoot/log/index/` for navigation by event type, action, and object number.

The package does not:

- own deployment or container infrastructure;
- own process lifecycle;
- interpret task meaning;
- orchestrate multiple executions;
- maintain cross-event decision state.

## Host Startup

The host should initialize the package in this order:

1. create the runtime configuration DTO;
2. configure `Github_Flows_Config_Runtime`;
3. optionally register one `Github_Flows_Event_Attribute_Provider`;
4. resolve `Github_Flows_Web_Server`;
5. start the web server.

## Runtime Configuration

The runtime configuration is flat and uses these fields:

- `httpHost` - optional, defaults to `127.0.0.1`;
- `httpPort` - optional, defaults to `3000`;
- `workspaceRoot` - required;
- `webhookSecret` - required.

## Observability

For each admitted event, the package writes a canonical archival directory:

- `workspaceRoot/log/run/{owner}/{repo}/{eventId}/`

It may also create observational symlink indexes for easier navigation:

- `workspaceRoot/log/index/by-event/{owner}/{repo}/{eventType}/{eventId}`
- `workspaceRoot/log/index/by-action/{owner}/{repo}/{eventType}/{action}/{eventId}`
- `workspaceRoot/log/index/by-number/{owner}/{repo}/{objectType}/{number}/{eventId}`

These indexes are derivative views only. The canonical event log storage remains under `log/run/`.

## Git Authentication

When the host environment provides `GH_TOKEN` or `GITHUB_TOKEN`, the package uses that token for non-interactive `git` operations during repository-cache synchronization and execution-workspace preparation.

## Event Attribute Provider

The optional host-provided provider must implement:

```js
async getAttributes({ headers, loggingContext, payload })
```

The provider returns additional attributes for the current admitted event only. It does not return execution permission.

## Release Contents

The npm package publishes:

- `src/`
- `ai/`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- `types.d.ts`

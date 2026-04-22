# github-flows

`@teqfw/github-flows` is a TeqFW library for GitHub webhook driven agent execution.

It accepts GitHub webhooks on a fixed ingress, builds one admitted-event model, derives package-owned base attributes from it, resolves zero or one effective profile from `workspaceRoot/cfg/`, and starts at most one isolated execution for each admitted event.

It is not a standalone application. The host application owns process lifecycle, runtime infrastructure, and startup orchestration.

If you want a ready-to-run web server application built on top of this package, see [github-flows-app](https://github.com/flancer32/github-flows-app).

## Documentation Map

This repository exposes two published documentation surfaces:

- `docs/` - human-facing documentation for configuring and using the package
- `ai/` - agent-facing documentation for AI assistants and host-side integrations

Development of the product also depends on a separate private cognitive-context repository. During development or controlled execution that context is mounted at `./ctx/`, but it is not part of the published product contract and is not required for package use at runtime.

For human-facing reading, start here:

1. [docs/overview.md](docs/overview.md)
2. [docs/single-event-launch.md](docs/single-event-launch.md)
3. [docs/profile-example.md](docs/profile-example.md)
4. [docs/profile-layout.md](docs/profile-layout.md)
5. [docs/event-attributes.md](docs/event-attributes.md)
6. [docs/event-chains.md](docs/event-chains.md)

## Product Summary

The package:

- accepts GitHub webhook requests only on `/webhooks/github`
- builds one admitted-event model and derives package-owned base attributes from it
- may ask the host for additional event attributes for the current admitted event
- resolves candidate profiles from `workspaceRoot/cfg/`
- selects zero or one effective execution profile
- delegates the permitted execution to the host runtime boundary

The package does not:

- own deployment or container infrastructure
- own process lifecycle
- interpret task meaning
- orchestrate multiple executions
- maintain cross-event decision state

## Runtime Entry Points

- `Github_Flows_Config_Runtime`
- `Github_Flows_Event_Attribute_Provider_Holder`
- `Github_Flows_Web_Server`
- `Github_Flows_Web_Handler_Webhook`

## Host Startup

The host should initialize the package in this order:

1. create the runtime configuration DTO
2. configure `Github_Flows_Config_Runtime`
3. optionally register one `Github_Flows_Event_Attribute_Provider`
4. resolve `Github_Flows_Web_Server`
5. start the web server

## Runtime Configuration

The runtime configuration uses these fields:

- `httpHost` - optional, defaults to `127.0.0.1`
- `httpPort` - optional, defaults to `3000`
- `workspaceRoot` - required
- `webhookSecret` - required

## Operational Notes

For each admitted event, the package writes canonical archival logs under:

- `workspaceRoot/log/run/{owner}/{repo}/{eventId}/`

When the host environment provides `GH_TOKEN` or `GITHUB_TOKEN`, the package uses that token for non-interactive `git` operations during repository-cache synchronization and execution-workspace preparation.

The optional host-provided attribute provider must implement:

```js
async getAttributes({ eventModel, headers, loggingContext, payload })
```

It returns additional attributes for the current admitted event only and does not return execution permission.

Use `eventModel` as the preferred source for package-owned base attributes such as `event`, `action`, `repository`, and `actorLogin`.

Keep using raw `payload` for business-specific GitHub event facts that the package does not normalize.

## Release Contents

The npm package publishes:

- `src/`
- `ai/`
- `docs/`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- `types.d.ts`

# Core Abstractions

- Path: `ai/abstractions.md`
- Version: `20260419`

## Web Server

`Github_Flows_Web_Server` is the host-started component that exposes the package HTTP surface.

It must be started by the host after runtime configuration is frozen.

## Runtime Configuration

`Github_Flows_Config_Runtime` is the package runtime configuration component.

Required fields:

- `workspaceRoot`
- `webhookSecret`

Optional fields:

- `httpHost`
- `httpPort`

`workspaceRoot` also anchors repository cache, execution workspaces, canonical event-log archives, and observational log indexes.

## Event Attribute Provider

`Github_Flows_Event_Attribute_Provider` is a host-provided contract.

It exposes one asynchronous method:

```js
async getAttributes({eventModel, headers, loggingContext, payload})
```

The provider returns host-provided additional event attributes for the current admitted event only.

`eventModel` is the preferred source for package-owned base attributes.

`payload` remains available for business-specific event facts that are outside the package-owned normalized model.

## Provider Holder

`Github_Flows_Event_Attribute_Provider_Holder` is the public host boundary for provider registration.

It exposes:

- `get()`
- `set(provider)`

The host may register at most one provider for the application lifetime.

## Webhook Handler

`Github_Flows_Web_Handler_Webhook` is the public handler for the fixed ingress path `/webhooks/github`.

It admits GitHub webhook requests, builds one admitted-event model, resolves the event attribute set, resolves a profile, and starts execution only when a profile is selected.

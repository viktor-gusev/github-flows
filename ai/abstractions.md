# Core Abstractions

## Webhook Ingress

`Github_Flows_Web_Handler_Webhook$` is the public PROCESS-stage handler that owns the fixed GitHub webhook ingress `/webhooks/github`.

For each matching request it:

- validates the GitHub signature;
- admits the event into package evaluation;
- resolves event attributes;
- selects zero or one effective execution profile;
- starts execution when a profile is selected.

## Runtime Configuration

`Github_Flows_Config_Runtime$` is the package runtime configuration component. The host configures it during startup and then treats it as immutable.

Required runtime fields are:

- `workspaceRoot`
- `runtimeImage`
- `webhookSecret`

The runtime DTO is not the registration surface for event-attribute providers.

## Event Attribute Provider

`Github_Flows_Event_Attribute_Provider` is a host-provided contract, not a package-owned decision engine.

It exposes one method:

```js
async getAttributes({headers, loggingContext, payload}) => additionalAttributes
```

The provider receives the admitted current event only and returns additional plain attributes for profile matching.

The provider does not return `allow`, `deny`, or any execution decision.

## Provider Holder

`Github_Flows_Event_Attribute_Provider_Holder$` is the public host boundary for provider registration.

It exposes:

- `get()`
- `set(provider)`

The host resolves this holder from the container during startup and registers at most one provider implementation for the application lifetime.

## Event Attribute Resolver

`Github_Flows_Event_Attribute_Resolver$` is package-internal. Host applications normally do not use it directly.

It:

- derives package-owned base attributes from the GitHub event;
- reads the optional provider from `Github_Flows_Event_Attribute_Provider_Holder$`;
- merges additional host-provided attributes into the final attribute set;
- returns the merged attributes to package-owned profile resolution.

## Profile Resolution

`Github_Flows_Execution_Profile_Resolver$` remains the package-owned selector.

It receives event attributes and:

- scans candidate profiles from `workspaceRoot/cfg/`;
- matches candidates against the attribute set;
- selects the highest-specificity match with stable filesystem ordering as tie-breaker;
- returns zero or one effective profile.

The host may contribute attributes, but the package owns the selection decision.

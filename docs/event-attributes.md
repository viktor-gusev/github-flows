# Event Attributes

This guide describes which event attributes may be used for profile matching.

## Base Attributes

The package provides these package-owned base attributes from the admitted-event model:

- `event`
- `repository`
- `action`
- `actorLogin` when the admitted GitHub event exposes the initiating actor login

These are the default routing inputs for `trigger`.

Example:

```json
{
  "trigger": {
    "repository": "acme/demo",
    "event": "pull_request",
    "action": "opened"
  }
}
```

## Host-Provided Attributes

The host application may register one `Event Attribute Provider` that derives additional attributes for the current admitted event.

Those additional attributes:

- belong only to the current event
- may participate in matching
- do not grant execution permission by themselves
- do not replace package-owned selection

This is useful when GitHub payload data contains an important routing fact that is not part of the package-owned base attribute set.

The host provider works alongside the package-owned admitted-event model:

- use package-owned base attributes such as `event`, `repository`, `action`, and optional `actorLogin` directly when they are sufficient;
- use host-provided attributes when routing depends on additional event facts outside that normalized base set.

Example use cases:

- expose a normalized branch category or repository class
- expose a repository-specific review lane
- expose a policy tier used for the current repository event
- expose an issue author login or another event-specific GitHub fact that remains outside the package-owned normalized base set

## Recommended Use

Use host-provided additional attributes only for missing event facts.

Do not use them to hide business decisions or orchestration state inside the host. Profile matching should stay transparent and event-local.

## Prompt Variables

Prompt variables are related but separate.

They are resolved after one profile was selected and do not participate in matching. Use them to materialize prompt text, not to decide whether a profile applies.

## Next Step

After this guide, read:

- [single-event-launch.md](single-event-launch.md) for one-event setup
- [event-chains.md](event-chains.md) for routing between stages through new GitHub events

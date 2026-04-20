# Event Attributes

This guide describes which attributes may be used for profile matching.

## Base Attributes

The package provides these base attributes from the admitted GitHub event:

- `event`
- `repository`
- `action`

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

Those attributes:

- belong only to the current event
- may participate in matching
- do not grant execution permission by themselves
- do not replace package-owned selection

This is useful when GitHub payload data contains an important routing fact that is not part of the base package attribute set.

Example use cases:

- expose a normalized branch category or repository class
- expose a repository-specific review lane
- expose a policy tier used for the current repository event

## Recommended Use

Use host-provided attributes only for missing event facts.

Do not use them to hide business decisions or orchestration state inside the host. Profile matching should stay transparent and event-local.

## Prompt Variables

Prompt variables are related but separate.

They are resolved after one profile was selected and do not participate in matching. Use them to materialize prompt text, not to decide whether a profile applies.

## Next Step

After this guide, read:

- [single-event-launch.md](single-event-launch.md) for one-event setup
- [event-chains.md](event-chains.md) for routing between stages through new GitHub events

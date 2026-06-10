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

`scalar` means `string`, `number`, `boolean`, or `null`.

```json
{
  "trigger": {
    "event": "scalar | [scalar, ...]",
    "repository": "scalar | [scalar, ...]",
    "action": "scalar | [scalar, ...]",
    "actorLogin": "scalar | [scalar, ...]",
    "ADDITIONAL_ATTRIBUTE_NAME": "scalar | [scalar, ...]"
  }
}
```

Trigger arrays are configuration-time sugar only. After hierarchical profile merging, the package expands trigger arrays into scalar candidate profiles. Runtime matching then compares scalar event attributes with scalar candidate trigger values only. Empty trigger arrays contribute no candidate profiles.

## Host-Provided Attributes

The host application may register one `Event Attribute Provider` that derives additional attributes for the current admitted event.

Those additional attributes:

- belong only to the current event
- may participate in matching
- may be reused later as explicit `host.*` prompt-variable sources for that same event
- do not grant execution permission by themselves
- do not replace package-owned selection

This is useful when GitHub payload data contains an important routing fact that is not part of the package-owned base attribute set.

The host provider works alongside the package-owned admitted-event model:

- use package-owned base attributes such as `event`, `repository`, `action`, and optional `actorLogin` directly when they are sufficient;
- use host-provided attributes when routing depends on additional event facts outside that normalized base set.

Host-provided additional attributes follow the same trigger-value model as package-owned base attributes: a trigger may use either one scalar value or an array of scalar alternatives for that attribute.

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

Bindings are direct only. The package does not interpret expressions, conditions, fallback chains, or transforms inside `promptVariables`.

Allowed binding roots are:

- `event.*` for admitted-event payload fields
- `host.*` for same-event host-provided additional attributes
- `workspace.*` for execution-preparation values already known to the package

The recommended prompt-binding form separates `required` and `optional` bindings:

- required bindings must resolve to exactly one scalar value for the current event;
- optional bindings may define `{ "path": "...", "default": ... }`;
- if an optional binding does not resolve and no default is declared, that variable is absent from the prompt context;
- if an optional binding uses `default: null`, the package materializes an empty string for prompt text.

Legacy flat binding maps remain valid and are interpreted as required-only bindings.

Example:

```json
{
  "execution": {
    "handler": {
      "promptVariables": {
        "required": {
          "ISSUE_TITLE": "event.issue.title",
          "WORKSPACE_PATH": "workspace.workspacePath"
        },
        "optional": {
          "REVIEW_LANE": {
            "path": "host.reviewLane",
            "default": null
          }
        }
      }
    }
  }
}
```

## Next Step

After this guide, read:

- [single-event-launch.md](single-event-launch.md) for one-event setup
- [event-chains.md](event-chains.md) for routing between stages through new GitHub events

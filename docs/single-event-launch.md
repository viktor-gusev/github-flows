# Single Event Launch

This guide shows how to configure one isolated handler run for one admitted GitHub event.

## Execution Rule

`github-flows` evaluates each event independently.

For one event, the package:

1. derives package-owned base attributes from the admitted-event model
2. optionally asks the host for additional event attributes
3. scans `workspaceRoot/cfg/` for `profile.json` fragments
4. builds candidate profiles by hierarchical merge
5. selects the most specific matching profile
6. starts one execution if a profile was selected

Before step 1, the package admits the webhook request and builds one admitted-event model. Package-owned base attributes are derived from that model; host-provided additional attributes may still come from the raw payload through the optional host provider.

If no profile matches, the event is ignored.

## Minimal Configuration

`cfg/profile.json`

```json
{
  "execution": {
    "handler": {
      "type": "agent",
      "command": ["codex"],
      "args": [],
      "promptRef": "prompts/default.md"
    },
    "runtime": {
      "image": "ghcr.io/acme/codex-agent:latest",
      "setupScript": "test -d repo",
      "timeoutSec": 1800,
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

`cfg/repos/acme/demo/issues-opened/profile.json`

```json
{
  "trigger": {
    "repository": "acme/demo",
    "event": "issues",
    "action": "opened"
  },
  "execution": {
    "handler": {
      "promptRef": "prompt.md",
      "promptVariables": {
        "REPOSITORY": "event.repository.full_name",
        "ISSUE_NUMBER": "event.issue.number",
        "ISSUE_TITLE": "event.issue.title"
      }
    }
  }
}
```

`cfg/repos/acme/demo/issues-opened/prompt.md`

```md
Repository: {{REPOSITORY}}
Issue: #{{ISSUE_NUMBER}}
Title: {{ISSUE_TITLE}}

Classify the issue and propose the next repository action.
```

## What This Configuration Means

In this layout:

- the root fragment defines default runtime and handler settings
- the nested fragment narrows applicability to `issues/opened` in `acme/demo`
- both fragments are merged into one candidate profile for that path
- if that candidate is the most specific match, one Docker-isolated execution starts

## Recommended Trigger Style

Keep `trigger` focused on stable routing signals:

- `repository`
- `event`
- `action`
- optional host-provided additional attributes for the current event

Avoid embedding branching logic inside one profile. If two event situations need different behavior, create two profiles.

## Next Step

After this guide, read:

- [profile-layout.md](profile-layout.md) for fragment structure and matching strategy
- [event-attributes.md](event-attributes.md) for base and host-provided attributes

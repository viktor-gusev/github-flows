# Single Event Launch

This guide shows how to configure one isolated agent run for one admitted GitHub event.

## Execution Rule

`github-flows` evaluates each event independently.

For one event, the package:

1. derives event attributes
2. optionally asks the host for additional attributes
3. scans `workspaceRoot/cfg/` for `profile.json` fragments
4. builds candidate profiles by hierarchical merge
5. selects the most specific matching profile
6. starts one execution if a profile was selected

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
      "type": "docker",
      "image": "ghcr.io/acme/codex-agent:latest",
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
- if that candidate is the most specific match, one execution starts

## Recommended Trigger Style

Keep `trigger` focused on stable routing signals:

- `repository`
- `event`
- `action`
- optional host-provided attributes for the current event

Avoid embedding branching logic inside one profile. If two event situations need different behavior, create two profiles.

## Next Step

After this guide, read:

- [profile-layout.md](profile-layout.md) for fragment structure and matching strategy
- [event-attributes.md](event-attributes.md) for base and host-provided attributes

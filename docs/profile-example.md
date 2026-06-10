# Profile Example

This document shows one complete `profile.json` example for a pull-request event.

It is a concrete example of the model described in [single-event-launch.md](single-event-launch.md), [profile-layout.md](profile-layout.md), and [event-attributes.md](event-attributes.md).

## Example

```json
{
  "trigger": {
    "event": "pull_request",
    "repository": "acme/demo",
    "action": "opened",
    "actorLogin": ["octocat", "hubot"],
    "reviewLane": "priority"
  },
  "execution": {
    "handler": {
      "type": "agent",
      "command": ["codex"],
      "args": ["exec", "--dangerously-bypass-approvals-and-sandbox", "-C", "/workspace/repo"],
      "promptRef": "prompts/default.md",
      "promptVariables": {
        "required": {
          "PR_TITLE": "event.pull_request.title",
          "PR_BODY": "event.pull_request.body",
          "REPOSITORY": "event.repository.full_name"
        },
        "optional": {
          "REVIEW_LANE": {
            "path": "host.reviewLane",
            "default": ""
          }
        }
      }
    },
    "runtime": {
      "image": "codex-agent:latest",
      "setupScript": "test -d repo",
      "timeoutSec": 1800,
      "env": {
        "LOG_LEVEL": "info"
      },
      "dockerArgs": [
        "--mount",
        "type=bind,src=/home/user/.codex,dst=/home/node/.codex",
        "--mount",
        "type=bind,src=/home/user/.config/gh,dst=/home/node/.config/gh"
      ]
    }
  }
}
```

## What It Shows

- `trigger` may combine canonical package-owned base attributes with host-provided additional attributes for matching this event.
- `actorLogin` uses trigger-array sugar that expands into scalar candidate profiles after profile merge and before matching.
- `handler.type` is `agent`, while `codex` remains only the concrete command being launched.
- `runtime` contains Docker-scoped launch parameters; Docker is the mandatory execution boundary.
- `promptVariables.required` binds mandatory prompt placeholders directly to allowed same-event sources such as `event.*`, `host.*`, and `workspace.*`.
- `promptVariables.optional` allows explicit fallback defaults for values such as `REVIEW_LANE`.

## Related Reading

- [single-event-launch.md](single-event-launch.md)
- [profile-layout.md](profile-layout.md)
- [event-attributes.md](event-attributes.md)

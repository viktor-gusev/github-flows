# Event Chains

This guide describes how to design multi-step automation around GitHub repository events without turning `github-flows` into a workflow engine.

## Core Rule

The package handles one event at a time.

Users may design multi-step automation around GitHub events:

`event A -> agent run A -> repository effect -> event B -> agent run B`

Inside the package, each step remains a separate, independent profile-selection decision.

In this model, `github-flows` is centered on repository-domain events. The main chaining surface is built from events such as:

- `issues`
- `issue_comment`
- `pull_request`
- `pull_request_review`

The agent handles one incoming event, performs repository actions, and those actions may cause GitHub to emit a later event that can independently trigger another run.

## Preferred Chaining Patterns

### 1. Issue-Centered Chains

Prefer first-class GitHub events when the previous step already produces them naturally.

Example:

1. `issues:opened`
2. an agent adds label `needs-spec`
3. GitHub emits `issues:labeled`
4. another profile handles `issues:labeled`

This is the cleanest pattern because the resulting automation stays visible in normal repository activity.

Other common issue-centered transitions:

- `issues:opened -> issue_comment:created`
- `issues:opened -> issues:assigned`
- `issues:labeled -> issue_comment:created`

### 2. Pull Request-Centered Chains

Pull request events are another natural foundation for flows.

Example:

1. `pull_request:opened`
2. an agent reviews the PR or posts a comment
3. GitHub emits `pull_request_review` or `issue_comment`
4. another profile handles the follow-up event

Other common pull-request transitions:

- `pull_request:opened -> pull_request_review:submitted`
- `pull_request:opened -> issue_comment:created`
- `pull_request:synchronize -> pull_request_review:submitted`

## Runtime Semantics

The package does not model a workflow, chain, or sequence as one internal object.

At runtime, each admitted event is handled independently:

- one event is admitted
- one profile may be selected
- one agent run may happen
- the agent may produce repository changes outside the package
- GitHub may later emit another event that is evaluated independently

This keeps orchestration outside the package internals and aligned with native GitHub behavior.

## Recommended Design Rules

- keep one profile per event-stage
- make the next step observable as a normal GitHub event whenever possible
- keep cross-stage design outside package internals and outside profile logic
- use host-provided attributes only to expose missing event facts

## What Not To Do

Avoid these patterns:

- one profile representing the whole business workflow
- hidden cross-event state in the host attribute provider
- conditional orchestration logic inside prompt templates
- treating directory layout as workflow semantics
- describing the package as if it correlates or sequences events internally

## Related Guides

- [overview.md](overview.md)
- [single-event-launch.md](single-event-launch.md)
- [profile-layout.md](profile-layout.md)
- [event-attributes.md](event-attributes.md)

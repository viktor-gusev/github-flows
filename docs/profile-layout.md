# Profile Layout

This guide describes how to organize `workspaceRoot/cfg/` and how profile fragments become one effective profile.

## Core Rule

One `profile.json` file is one fragment, not one complete execution profile.

Fragments are merged hierarchically along one filesystem path. Each merged path produces one candidate profile. The package then selects the most specific matching candidate for the current event.

## Recommended Layout

One practical layout is:

```text
cfg/
  profile.json
  repos/
    acme/
      demo/
        profile.json
        issues-opened/
          profile.json
          prompt.md
        pr-opened/
          profile.json
          prompt.md
        pr-reviewed/
          profile.json
          prompt.md
```

Interpret this tree as organization and inheritance only. Directory names do not match events by themselves. Matching comes only from `trigger` fields inside `profile.json`.

## Merge Model

For a path such as:

`cfg/profile.json -> cfg/repos/acme/demo/profile.json -> cfg/repos/acme/demo/issues-opened/profile.json`

the package merges those fragments from top to bottom.

Typical use:

- higher fragments define defaults
- lower fragments narrow the trigger
- lower fragments override prompt or runtime details for one event stage

## Matching Model

Candidate profiles are matched against the current event attribute set.

Selection rules:

- every defined `trigger` field must match
- all matching candidates are considered
- the most specific match wins
- ties are resolved by stable filesystem-derived ordering

That means deeper layout can help organization, but specificity comes from `trigger` content, not from path depth alone.

## Recommended Fragment Strategy

Use the tree to separate concerns:

- root fragment for shared runtime defaults
- repository fragment for repo-level defaults
- event-stage fragment for one concrete trigger and one prompt

This keeps each fragment small and makes later event-chain design easier to read.

## Next Step

After this guide, read:

- [event-attributes.md](event-attributes.md) for what may appear in `trigger`
- [event-chains.md](event-chains.md) for multi-step composition across events

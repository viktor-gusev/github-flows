# Package Overview

`@teqfw/github-flows` is GitHub-webhook-driven execution infrastructure for TeqFW applications. It receives GitHub events through a fixed webhook ingress, resolves one effective execution profile from declarative `cfg/profile.json` fragments, and starts at most one isolated execution for each admitted event.

This package is not a standalone application, orchestration engine, or semantic event interpreter. Its role is limited to:

- admitting GitHub webhook requests on `/webhooks/github`;
- deriving event attributes for profile matching;
- optionally asking the host application for additional event attributes;
- selecting zero or one effective execution profile;
- delegating permitted execution to the package runtime boundary.

The package assumes `@teqfw/di` and exposes its consumer-facing runtime surface through DI-managed modules under the `Github_Flows_` namespace rooted at the published `src/` tree.

Use this package when external code needs one of these roles:

- expose GitHub webhook ingress inside a TeqFW host application;
- launch isolated handlers from declarative event-profile mappings;
- enrich admitted events with host-specific additional attributes before profile matching;
- keep execution permission package-owned while allowing host-provided attribute derivation.

Do not use this package as:

- a manually wired standalone webhook application;
- a host-controlled allow/deny validator layer;
- a workflow engine or cross-event coordination system;
- a package that lets the host decide execution permission directly.

The main consumer entry points are:

- `Github_Flows_Config_Runtime$` for package runtime configuration;
- `Github_Flows_Event_Attribute_Provider_Holder$` for optional host-side registration of one event-attribute provider;
- `Github_Flows_Web_Server$` for starting the package web ingress;
- `Github_Flows_Web_Handler_Webhook$` when the host needs the public webhook handler surface itself.

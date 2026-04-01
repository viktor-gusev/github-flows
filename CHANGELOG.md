# Changelog

## 0.7.0 - 2026-04-01

### Highlights

- aligned runtime dependency assignment so the web server receives its runtime dependency unconditionally;
- refined the runtime configuration hierarchy and flattened the runtime config shape;
- synchronized runtime config and wrapper names with the TeqFW specification;
- added TeqFW type map and web server typings;
- documented the public component contract and host integration flow;
- updated TeqFW dependencies and package metadata.

### Notable Changes

- `7a7fc85` Make runtime dependency assignment unconditional
- `60146a2` Refine runtime config hierarchy
- `6b41983` fix(issue 8): initialize web runtime config
- `447c60e` update teq dependencies
- `4c8f937` flatten runtime config
- `e5d9d30` Separate CDC and type namespace for runtime config
- `724e2ad` Align runtime config with TeqFW spec
- `7b1d570` Align runtime wrapper name with spec
- `56ea66a` Add TeqFW type map and web server typings
- `16c0023` Add github-flows web server component
- `d8c57cc` Document TeqFW public component contract
- `7a1f30f` Document TeqFW host integration example

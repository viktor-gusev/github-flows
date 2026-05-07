# Test Tree

## Purpose

This directory contains verification artifacts for the package.

It does not define product behavior. It verifies behavior defined by `ctx/`.

## Structure

- `unit/` — module-level verification in isolation.
- `integration/` — runtime-scenario verification under composition.

## Working Rules

- Follow the TeqFW testing model in:
  - `ctx/spec/ns/teqfw/platform/quality/testing/overview.md`
  - `ctx/spec/ns/teqfw/platform/quality/testing/unit.md`
  - `ctx/spec/ns/teqfw/platform/quality/testing/integration.md`
  - `ctx/spec/ns/teqfw/platform/quality/testing/fixtures.md`
- Follow project-local testing refinements in:
  - `ctx/docs/code/testing.md`
- Keep `unit/` and `integration/` responsibilities separate.
- Place any shared fixtures under the owning layer inside `test/`.
- Use `node:test` and `node:assert/strict` as the normative stack.
- In integration tests, container test mode and registered container mocks are allowed only when they preserve the runtime invariant under test and do not bypass the package-owned contract being verified.

## Boundary

- Do not move testing-only assets outside `test/`.
- Do not treat mocks as product behavior.
- Do not weaken or remove an existing scenario without a corresponding change in the documented runtime contract.

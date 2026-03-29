# github-flows

`@teqfw/github-flows` is a reusable TeqFW library for handling GitHub webhook events and starting agents from those events inside a host application.

It is not a standalone executable application.

## Public Components

- `Github_Flows_Config_Runtime` - runtime configuration provider.
- `Github_Flows_Web_Server` - web server component started by the host.

## Host Startup Flow

The host application is responsible for bootstrap order:

1. Create a runtime configuration DTO.
2. Initialize `Github_Flows_Config_Runtime`.
3. Resolve `Github_Flows_Web_Server` from the DI container.
4. Start the web server explicitly.

The web server reads its configuration from the DI container after runtime configuration has been initialized.

## Runtime Configuration

Runtime configuration parameters are documented in the code context at [ctx/docs/code/component/configuration/runtime.md](/home/alex/work/app/github-flows/ctx/docs/code/component/configuration/runtime.md) and are expected to be initialized by the host before server startup.

The runtime DTO is flat and uses these fields:

- `httpHost` - optional, default `127.0.0.1`
- `httpPort` - optional, default `3000`
- `workspaceRoot` - required
- `runtimeImage` - required
- `webhookSecret` - required

## TeqFW Model

The package follows the TeqFW DI model:

- components are published through namespaces
- dependencies are resolved by the container
- the package does not own the process lifecycle
- the package does not define a standalone `start` entrypoint

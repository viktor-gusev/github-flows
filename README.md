# github-flows

`@teqfw/github-flows` is a reusable TeqFW library for handling GitHub webhook events and starting agents from those events inside a host application.

Current release: `0.1.0`.

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

Runtime configuration parameters are documented in the code context at [ctx/docs/code/component/configuration/runtime.md](ctx/docs/code/component/configuration/runtime.md) and are expected to be initialized by the host before server startup.

The runtime DTO is flat and uses these fields:

- `httpHost` - env: `HOST`, optional, default `127.0.0.1`
- `httpPort` - env: `PORT`, optional, default `3000`
- `workspaceRoot` - env: `WORKSPACE_ROOT`, required
- `runtimeImage` - env: `RUNTIME_IMAGE`, required
- `webhookSecret` - env: `WEBHOOK_SECRET`, required

## TeqFW Model

The package follows the TeqFW DI model:

- components are published through namespaces
- dependencies are resolved by the container
- the package does not own the process lifecycle
- the package does not define a standalone `start` entrypoint

## Host Integration Example

The example below shows a minimal TeqFW host application component that injects the public library components, initializes runtime configuration, and then starts the library web server.

```javascript
/**
 * Host application root component.
 */
export default class App_Root {
  /**
   * @param {object} deps
   * @param {Github_Flows_Config_Runtime} deps.appCfgRuntime
   * @param {Github_Flows_Web_Server} deps.appWebServer
   */
  constructor({ appCfgRuntime, appWebServer }) {
    this.start = function () {
      appCfgRuntime.configure({
        httpHost: "127.0.0.1",
        httpPort: 3000,
        workspaceRoot: "./var/work",
        runtimeImage: "codex-agent",
        webhookSecret: "replace-with-shared-secret",
      });
      appCfgRuntime.freeze();

      return appWebServer.start();
    };
  }
}

export const __deps__ = Object.freeze({
  appCfgRuntime: "Github_Flows_Config_Runtime$",
  appWebServer: "Github_Flows_Web_Server$",
});
```

In this example:

- the host app component receives the library components through the constructor
- the host initializes `Github_Flows_Config_Runtime` before server startup
- the host starts `Github_Flows_Web_Server` explicitly
- the library server reads its finalized configuration from the DI container

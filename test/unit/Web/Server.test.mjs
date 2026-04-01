import test from "node:test";
import assert from "node:assert/strict";
import Github_Flows_Web_Server from "../../../src/Web/Server.mjs";

async function loadRuntimeModule(tag) {
  return import(`../../../src/Config/Runtime.mjs?${tag}`);
}

function createServerStub() {
  const calls = [];
  const instance = { id: "server-instance" };

  return {
    calls,
    server: {
      getInstance() {
        calls.push({ method: "getInstance" });
        return instance;
      },
      async start(cfg) {
        calls.push({ method: "start", cfg });
      },
      async stop() {
        calls.push({ method: "stop" });
      },
    },
    instance,
  };
}

function createConfigFactoryStub() {
  const calls = [];

  return {
    calls,
    factory: {
      configure(cfg) {
        calls.push({ method: "configure", cfg });
      },
      freeze() {
        calls.push({ method: "freeze" });
      },
    },
  };
}

async function createRuntimeConfig({ port = 3000 } = {}) {
  const { Factory, default: Github_Flows_Config_Runtime } = await loadRuntimeModule(`server-${port}`);
  const factory = new Factory();
  const config = new Github_Flows_Config_Runtime();

  factory.configure({
    httpHost: "127.0.0.1",
    httpPort: port,
    workspaceRoot: "./var/work",
    runtimeImage: "codex-agent",
    webhookSecret: "shared-secret",
  });
  factory.freeze();

  return { config, factory };
}

test("web server delegates startup to teq-web server with runtime port", async () => {
  const { calls, server: serverStub } = createServerStub();
  const { calls: factoryCalls, factory: configFactoryStub } = createConfigFactoryStub();
  const { config } = await createRuntimeConfig({ port: 3030 });
  const server = new Github_Flows_Web_Server({ server: serverStub, configFactory: configFactoryStub, config });

  await server.start();

  assert.deepEqual(factoryCalls, [
    { method: "configure", cfg: { port: 3030, type: "http" } },
    { method: "freeze" },
  ]);
  assert.deepEqual(calls, [
    { method: "start", cfg: { port: 3030, type: "http" } },
  ]);
});

test("web server forwards explicit runtime overrides", async () => {
  const { calls, server: serverStub } = createServerStub();
  const { calls: factoryCalls, factory: configFactoryStub } = createConfigFactoryStub();
  const { config } = await createRuntimeConfig({ port: 3031 });
  const server = new Github_Flows_Web_Server({ server: serverStub, configFactory: configFactoryStub, config });

  await server.start({ port: 8080, type: "https", tls: { key: "k", cert: "c" } });

  assert.deepEqual(factoryCalls, [
    { method: "configure", cfg: { port: 8080, type: "https", tls: { key: "k", cert: "c" } } },
    { method: "freeze" },
  ]);
  assert.deepEqual(calls, [
    { method: "start", cfg: { port: 8080, type: "https", tls: { key: "k", cert: "c" } } },
  ]);
});

test("web server delegates stop and instance lookup", async () => {
  const { calls, server: serverStub, instance } = createServerStub();
  const { factory: configFactoryStub } = createConfigFactoryStub();
  const { config } = await createRuntimeConfig({ port: 3032 });
  const server = new Github_Flows_Web_Server({ server: serverStub, configFactory: configFactoryStub, config });

  assert.equal(server.getInstance(), instance);

  await server.stop();

  assert.deepEqual(calls, [
    { method: "getInstance" },
    { method: "stop" },
  ]);
});

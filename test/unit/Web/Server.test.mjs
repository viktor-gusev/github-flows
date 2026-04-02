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

function createPipelineStub() {
  const calls = [];

  return {
    calls,
    pipeline: {
      addHandler(handler) {
        calls.push({ method: "addHandler", handler });
      },
    },
  };
}

async function createRuntimeConfig({ port = 3000 } = {}) {
  const { Factory, default: Github_Flows_Config_Runtime } = await loadRuntimeModule(`server-${port}`);
  const webConfig = {
    port,
    type: "http",
  };
  const factory = new Factory({
    webConfigFactory: {
      configure() {},
      freeze() {
        return webConfig;
      },
    },
  });
  const config = new Github_Flows_Config_Runtime();

  factory.configure({
    httpHost: "127.0.0.1",
    httpPort: port,
    workspaceRoot: "./var/work",
    runtimeImage: "codex-agent",
    webhookSecret: "shared-secret",
  });
  factory.freeze();

  return { config };
}

test("web server delegates startup to teq-web server with runtime port", async () => {
  const { calls: pipelineCalls, pipeline } = createPipelineStub();
  const { calls, server: serverStub } = createServerStub();
  const { config } = await createRuntimeConfig({ port: 3030 });
  const webhookHandler = { id: "webhook-handler" };
  const server = new Github_Flows_Web_Server({
    pipeline,
    server: serverStub,
    webhookHandler,
  });

  await server.start();

  assert.deepEqual(pipelineCalls, [
    { method: "addHandler", handler: webhookHandler },
  ]);
  assert.deepEqual(calls, [
    { method: "start", cfg: undefined },
  ]);
});

test("web server forwards explicit runtime overrides", async () => {
  const { calls: pipelineCalls, pipeline } = createPipelineStub();
  const { calls, server: serverStub } = createServerStub();
  const { config } = await createRuntimeConfig({ port: 3031 });
  const webhookHandler = { id: "webhook-handler" };
  const server = new Github_Flows_Web_Server({
    pipeline,
    server: serverStub,
    webhookHandler,
  });

  await server.start();

  assert.deepEqual(pipelineCalls, [
    { method: "addHandler", handler: webhookHandler },
  ]);
  assert.deepEqual(calls, [
    { method: "start", cfg: undefined },
  ]);
});

test("web server delegates stop and instance lookup", async () => {
  const { pipeline } = createPipelineStub();
  const { calls, server: serverStub, instance } = createServerStub();
  const { config } = await createRuntimeConfig({ port: 3032 });
  const server = new Github_Flows_Web_Server({
    pipeline,
    server: serverStub,
    webhookHandler: { id: "webhook-handler" },
  });

  assert.equal(server.getInstance(), instance);

  await server.stop();

  assert.deepEqual(calls, [
    { method: "getInstance" },
    { method: "stop" },
  ]);
});

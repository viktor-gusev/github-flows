import test from "node:test";
import assert from "node:assert/strict";

async function loadRuntimeModule(tag) {
  return import(`../../../src/Config/Runtime.mjs?${tag}`);
}

test("runtime config data has defaults", async () => {
  const { Data } = await loadRuntimeModule("defaults");
  const data = new Data();

  assert.equal(data.httpHost, undefined);
  assert.equal(data.httpPort, undefined);
  assert.equal(data.repoCacheLockPollIntervalMs, undefined);
  assert.equal(data.repoCacheLockStaleMs, undefined);
  assert.equal(data.repoCacheLockTimeoutMs, undefined);
  assert.equal(data.workspaceRoot, undefined);
  assert.equal(data.webhookSecret, undefined);
});

test("factory applies values and freezes required configuration", async () => {
  const { Factory, default: Github_Flows_Config_Runtime } = await loadRuntimeModule("factory-applies");
  const webConfigCalls = [];
  const webConfig = {
    getInstance() {
      return { id: "web-config" };
    },
  };
  const webConfigFactory = {
    configure(cfg) {
      webConfigCalls.push({ method: "configure", cfg });
    },
    freeze() {
      webConfigCalls.push({ method: "freeze" });
      return webConfig;
    },
  };
  const factory = new Factory({ webConfigFactory });
  const runtime = new Github_Flows_Config_Runtime();

  factory.configure({
    httpHost: "0.0.0.0",
    httpPort: 8080,
    repoCacheLockPollIntervalMs: 500,
    repoCacheLockStaleMs: 120000,
    repoCacheLockTimeoutMs: 10000,
    workspaceRoot: "./var/work",
    webhookSecret: "shared-secret",
  });
  factory.freeze();

  assert.equal(runtime.httpHost, "0.0.0.0");
  assert.equal(runtime.httpPort, 8080);
  assert.equal(runtime.repoCacheLockPollIntervalMs, 500);
  assert.equal(runtime.repoCacheLockStaleMs, 120000);
  assert.equal(runtime.repoCacheLockTimeoutMs, 10000);
  assert.equal(runtime.workspaceRoot, "./var/work");
  assert.equal(runtime.webhookSecret, "shared-secret");
  assert.equal(runtime.webConfig, webConfig);
  assert.deepEqual(webConfigCalls, [
    { method: "configure", cfg: { port: 8080, type: "http" } },
    { method: "freeze" },
  ]);
  assert.throws(() => {
    runtime.httpPort = 8081;
  }, /immutable/);
});

test("factory rejects missing required fields", async () => {
  const { Factory } = await loadRuntimeModule("factory-missing");
  const factory = new Factory({
    webConfigFactory: {
      configure() {},
      freeze() {
        return {};
      },
    },
  });

  factory.configure({
    webhookSecret: "shared-secret",
  });

  assert.throws(() => {
    factory.freeze();
  }, /workspaceRoot/);
});

test("factory applies default cache lock timings", async () => {
  const { Factory, default: Github_Flows_Config_Runtime } = await loadRuntimeModule("factory-lock-defaults");
  const factory = new Factory({
    webConfigFactory: {
      configure() {},
      freeze() {
        return {};
      },
    },
  });
  const runtime = new Github_Flows_Config_Runtime();

  factory.configure({
    workspaceRoot: "./var/work",
    webhookSecret: "shared-secret",
  });
  factory.freeze();

  assert.equal(runtime.repoCacheLockPollIntervalMs, 1000);
  assert.equal(runtime.repoCacheLockTimeoutMs, 60000);
  assert.equal(runtime.repoCacheLockStaleMs, 600000);
});

test("wrapper rejects access before initialization", async () => {
  const { Factory, default: Github_Flows_Config_Runtime } = await loadRuntimeModule("wrapper-before-freeze");
  const factory = new Factory({
    webConfigFactory: {
      configure() {},
      freeze() {
        return {};
      },
    },
  });
  const runtime = new Github_Flows_Config_Runtime();

  factory.configure({
    workspaceRoot: "./var/work",
    webhookSecret: "shared-secret",
  });

  assert.throws(() => runtime.httpHost, /not initialized/);
});

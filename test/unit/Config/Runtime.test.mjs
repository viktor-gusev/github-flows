import test from "node:test";
import assert from "node:assert/strict";

async function loadRuntimeModule(tag) {
  return import(`../../../src/Config/Runtime.mjs?${tag}`);
}

test("runtime config data has defaults", async () => {
  const { Data } = await loadRuntimeModule("defaults");
  const data = new Data();

  assert.equal(data.httpHost, "127.0.0.1");
  assert.equal(data.httpPort, 3000);
  assert.equal(data.workspaceRoot, undefined);
  assert.equal(data.runtimeImage, undefined);
  assert.equal(data.webhookSecret, undefined);
});

test("factory applies values and freezes required configuration", async () => {
  const { Factory, default: Github_Flows_Config_Runtime } = await loadRuntimeModule("factory-applies");
  const factory = new Factory();
  const runtime = new Github_Flows_Config_Runtime();

  factory.configure({
    httpHost: "0.0.0.0",
    httpPort: 8080,
    workspaceRoot: "./var/work",
    runtimeImage: "codex-agent",
    webhookSecret: "shared-secret",
  });
  factory.freeze();

  assert.equal(runtime.httpHost, "0.0.0.0");
  assert.equal(runtime.httpPort, 8080);
  assert.equal(runtime.workspaceRoot, "./var/work");
  assert.equal(runtime.runtimeImage, "codex-agent");
  assert.equal(runtime.webhookSecret, "shared-secret");
  assert.throws(() => {
    runtime.httpPort = 8081;
  }, /immutable/);
});

test("factory rejects missing required fields", async () => {
  const { Factory } = await loadRuntimeModule("factory-missing");
  const factory = new Factory();

  factory.configure({
    runtimeImage: "codex-agent",
    webhookSecret: "shared-secret",
  });

  assert.throws(() => {
    factory.freeze();
  }, /workspaceRoot/);
});

test("wrapper rejects access before initialization", async () => {
  const { Factory, default: Github_Flows_Config_Runtime } = await loadRuntimeModule("wrapper-before-freeze");
  const factory = new Factory();
  const runtime = new Github_Flows_Config_Runtime();

  factory.configure({
    workspaceRoot: "./var/work",
    runtimeImage: "codex-agent",
    webhookSecret: "shared-secret",
  });

  assert.throws(() => runtime.httpHost, /not initialized/);
});

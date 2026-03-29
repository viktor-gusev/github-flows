import test from "node:test";
import assert from "node:assert/strict";
import { Data, Factory } from "../../../src/Config/Runtime.mjs";
import Github_Flows_Config_Runtime from "../../../src/Config/Runtime.mjs";

test("runtime config data has defaults", () => {
  const data = new Data();

  assert.equal(data.httpHost, "127.0.0.1");
  assert.equal(data.httpPort, 3000);
  assert.equal(data.workspaceRoot, undefined);
  assert.equal(data.runtimeImage, undefined);
  assert.equal(data.webhookSecret, undefined);
});

test("factory applies values and freezes required configuration", () => {
  const data = new Data();
  const factory = new Factory({ depData: data });

  factory.configure({
    workspaceRoot: "./var/work",
    runtimeImage: "codex-agent",
    webhookSecret: "shared-secret",
  });
  factory.freeze();

  assert.equal(data.httpHost, "127.0.0.1");
  assert.equal(data.httpPort, 3000);
  assert.equal(data.workspaceRoot, "./var/work");
  assert.equal(data.runtimeImage, "codex-agent");
  assert.equal(data.webhookSecret, "shared-secret");
  assert.throws(() => {
    data.workspaceRoot = "./other";
  }, TypeError);
});

test("factory rejects missing required fields", () => {
  const data = new Data();
  const factory = new Factory({ depData: data });

  factory.configure({
    runtimeImage: "codex-agent",
    webhookSecret: "shared-secret",
  });

  assert.throws(() => {
    factory.freeze();
  }, /workspaceRoot/);
});

test("wrapper exposes read-only proxy", () => {
  const data = new Data();
  const factory = new Factory({ depData: data });
  const runtime = new Github_Flows_Config_Runtime({ depData: data });

  factory.configure({
    workspaceRoot: "./var/work",
    runtimeImage: "codex-agent",
    webhookSecret: "shared-secret",
  });
  factory.freeze();

  assert.equal(runtime.httpHost, "127.0.0.1");
  assert.equal(runtime.httpPort, 3000);
  assert.equal(runtime.workspaceRoot, "./var/work");
  assert.equal(runtime.runtimeImage, "codex-agent");
  assert.equal(runtime.webhookSecret, "shared-secret");
  assert.throws(() => {
    runtime.httpPort = 8080;
  }, TypeError);
});

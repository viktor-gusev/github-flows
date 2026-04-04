import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { EventEmitter } from "node:events";
import test from "node:test";

import Github_Flows_Web_Handler_Webhook from "../../../../src/Web/Handler/Webhook.mjs";

function createSignature(secret, body) {
  const digest = createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${digest}`;
}

function createRequest({ body = "{}", path = "/webhooks/github", secret = "shared-secret" } = {}) {
  const request = new EventEmitter();
  request.url = path;
  request.headers = {
    "content-type": "application/json",
    "x-github-event": "issues",
    "x-hub-signature-256": createSignature(secret, body),
  };

  queueMicrotask(() => {
    if (body.length > 0) request.emit("data", Buffer.from(body, "utf8"));
    request.emit("end");
  });

  return request;
}

function createContext({ body = "{}", path = "/webhooks/github", secret = "shared-secret" } = {}) {
  const calls = [];
  const eventLogCalls = [];
  const runtimeCalls = [];
  const workspaceCalls = [];

  return {
    calls,
    eventLogCalls,
    runtimeCalls,
    workspaceCalls,
    eventLog: {
      logReception(entry) {
        eventLogCalls.push({ method: "logReception", entry });
      },
      logIngress(entry) {
        eventLogCalls.push({ method: "logIngress", entry });
      },
      logDecisionTrace(entry) {
        eventLogCalls.push({ method: "logDecisionTrace", entry });
      },
    },
    executionWorkspacePreparer: {
      async prepareByGithubEvent(entry) {
        workspaceCalls.push(entry);
        return {
          repoPath: "/tmp/workspace/repo",
          workspacePath: "/tmp/workspace",
        };
      },
    },
    executionRuntimeDocker: {
      async run(entry) {
        runtimeCalls.push(entry);
        return {
          attempted: true,
          completed: true,
          exit: "success",
          stderr: "",
          stdout: "",
        };
      },
    },
    context: {
      request: createRequest({ body, path, secret }),
      response: {
        headersSent: false,
        writeHead(code, headers) {
          calls.push({ method: "writeHead", code, headers });
        },
        end(bodyText) {
          calls.push({ method: "end", body: bodyText });
        },
      },
      complete() {
        calls.push({ method: "complete" });
      },
    },
  };
}

test("webhook handler exposes teq-web handler contract", async () => {
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventLog: {},
    executionRuntimeDocker: { run: async () => ({ attempted: true, completed: true, exit: "success", stderr: "", stdout: "" }) },
    executionWorkspacePreparer: { prepareByGithubEvent: async () => {} },
    runtime: { webhookSecret: "shared-secret", runtimeImage: "codex-agent" },
    signature: { isValid: async () => true },
  });

  const info = handler.getRegistrationInfo();

  assert.equal(typeof handler.handle, "function");
  assert.equal(info.name, "Github_Flows_Web_Handler_Webhook");
  assert.equal(info.stage, "PROCESS");
  assert.deepEqual(info.before, []);
  assert.deepEqual(info.after, []);
});

test("webhook handler accepts matching webhook requests and logs admission after reception", async () => {
  const payload = {
    action: "opened",
    repository: {
      id: 1,
      name: "demo",
      owner: { login: "octocat" },
    },
  };
  const { calls, context, eventLog, eventLogCalls, executionRuntimeDocker, executionWorkspacePreparer, runtimeCalls, workspaceCalls } = createContext({
    body: JSON.stringify(payload),
  });
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventLog,
    executionRuntimeDocker,
    executionWorkspacePreparer,
    runtime: { webhookSecret: "shared-secret", runtimeImage: "codex-agent" },
    signature: { isValid: async () => true },
  });

  await handler.handle(context);

  assert.equal(eventLogCalls[0].method, "logReception");
  assert.deepEqual(workspaceCalls, [{ event: payload }]);
  assert.deepEqual(runtimeCalls, [{
    launchContract: {
      agent: {
        type: "codex",
        command: ["tee"],
        args: ["/tmp/github-flows-prompt.txt"],
        prompt: "Repository workspace prepared for GitHub event handling.",
      },
      environment: {
        image: "codex-agent",
        workspacePath: "/tmp/workspace",
        setupScript: "test -d repo",
        env: {},
        timeoutSec: 1800,
      },
    },
  }]);
  assert.deepEqual(eventLogCalls[1], {
    method: "logIngress",
    entry: { outcome: "admitted" },
  });
  assert.deepEqual(calls, [
    {
      method: "writeHead",
      code: 202,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    },
    {
      method: "end",
      body: JSON.stringify({ status: "accepted" }),
    },
    { method: "complete" },
  ]);
});

test("webhook handler rejects invalid signature after reception logging", async () => {
  const { calls, context, eventLog, eventLogCalls, executionWorkspacePreparer, workspaceCalls } = createContext();
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventLog,
    executionRuntimeDocker: { run: async () => ({ attempted: true, completed: true, exit: "success", stderr: "", stdout: "" }) },
    executionWorkspacePreparer,
    runtime: { webhookSecret: "shared-secret", runtimeImage: "codex-agent" },
    signature: { isValid: async () => false },
  });

  await handler.handle(context);

  assert.equal(eventLogCalls[0].method, "logReception");
  assert.deepEqual(workspaceCalls, []);
  assert.deepEqual(eventLogCalls[1], {
    method: "logIngress",
    entry: { outcome: "rejected", reason: "invalid-signature" },
  });
  assert.deepEqual(calls, [
    {
      method: "writeHead",
      code: 401,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    },
    {
      method: "end",
      body: JSON.stringify({ error: "unauthorized" }),
    },
    { method: "complete" },
  ]);
});

test("webhook handler ignores non-webhook paths", async () => {
  const { calls, context, eventLog, eventLogCalls, executionWorkspacePreparer } = createContext({ path: "/other" });
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventLog,
    executionRuntimeDocker: { run: async () => ({ attempted: true, completed: true, exit: "success", stderr: "", stdout: "" }) },
    executionWorkspacePreparer,
    runtime: { webhookSecret: "shared-secret", runtimeImage: "codex-agent" },
    signature: { isValid: async () => true },
  });

  await handler.handle(context);

  assert.deepEqual(calls, []);
  assert.deepEqual(eventLogCalls, []);
});

test("webhook handler rejects invalid json after signature validation", async () => {
  const { calls, context, eventLog, eventLogCalls, executionRuntimeDocker, executionWorkspacePreparer, workspaceCalls } = createContext({
    body: "{invalid-json",
  });
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventLog,
    executionRuntimeDocker,
    executionWorkspacePreparer,
    runtime: { webhookSecret: "shared-secret", runtimeImage: "codex-agent" },
    signature: { isValid: async () => true },
  });

  await handler.handle(context);

  assert.equal(eventLogCalls[0].method, "logReception");
  assert.deepEqual(workspaceCalls, []);
  assert.deepEqual(eventLogCalls[1], {
    method: "logIngress",
    entry: { outcome: "rejected", reason: "invalid-json" },
  });
  assert.deepEqual(calls, [
    {
      method: "writeHead",
      code: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    },
    {
      method: "end",
      body: JSON.stringify({ error: "invalid-json" }),
    },
    { method: "complete" },
  ]);
});

test("webhook handler returns 500 if workspace preparation fails", async () => {
  const payload = {
    action: "opened",
    repository: {
      id: 1,
      name: "demo",
      owner: { login: "octocat" },
    },
  };
  const { calls, context, eventLog, eventLogCalls, workspaceCalls } = createContext({
    body: JSON.stringify(payload),
  });
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventLog,
    executionRuntimeDocker: {
      async run() {
        throw new Error("runtime failed");
      },
    },
    executionWorkspacePreparer: {
      async prepareByGithubEvent(entry) {
        workspaceCalls.push(entry);
        return {
          repoPath: "/tmp/workspace/repo",
          workspacePath: "/tmp/workspace",
        };
      },
    },
    runtime: { webhookSecret: "shared-secret", runtimeImage: "codex-agent" },
    signature: { isValid: async () => true },
  });

  await handler.handle(context);

  assert.equal(eventLogCalls[0].method, "logReception");
  assert.deepEqual(workspaceCalls, [{ event: payload }]);
  assert.deepEqual(calls, [
    {
      method: "writeHead",
      code: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    },
    {
      method: "end",
      body: JSON.stringify({ error: "workspace-prepare-failed" }),
    },
    { method: "complete" },
  ]);
});

test("webhook handler returns 500 if workspace preparation fails", async () => {
  const payload = {
    action: "opened",
    repository: {
      id: 1,
      name: "demo",
      owner: { login: "octocat" },
    },
  };
  const { calls, context, eventLog, eventLogCalls, workspaceCalls } = createContext({
    body: JSON.stringify(payload),
  });
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventLog,
    executionRuntimeDocker: { run: async () => ({ attempted: true, completed: true, exit: "success", stderr: "", stdout: "" }) },
    executionWorkspacePreparer: {
      async prepareByGithubEvent(entry) {
        workspaceCalls.push(entry);
        throw new Error("workspace failed");
      },
    },
    runtime: { webhookSecret: "shared-secret", runtimeImage: "codex-agent" },
    signature: { isValid: async () => true },
  });

  await handler.handle(context);

  assert.equal(eventLogCalls[0].method, "logReception");
  assert.deepEqual(workspaceCalls, [{ event: payload }]);
  assert.deepEqual(calls, [
    {
      method: "writeHead",
      code: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    },
    {
      method: "end",
      body: JSON.stringify({ error: "workspace-prepare-failed" }),
    },
    { method: "complete" },
  ]);
});

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
  const repoCacheCalls = [];

  return {
    calls,
    eventLogCalls,
    repoCacheCalls,
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
    repoCacheManager: {
      async syncByGithubEvent(entry) {
        repoCacheCalls.push(entry);
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
    repoCacheManager: { syncByGithubEvent: async () => {} },
    runtime: { webhookSecret: "shared-secret" },
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
  const { calls, context, eventLog, eventLogCalls, repoCacheCalls, repoCacheManager } = createContext({
    body: JSON.stringify(payload),
  });
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventLog,
    repoCacheManager,
    runtime: { webhookSecret: "shared-secret" },
    signature: { isValid: async () => true },
  });

  await handler.handle(context);

  assert.equal(eventLogCalls[0].method, "logReception");
  assert.deepEqual(repoCacheCalls, [{ event: payload }]);
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
  const { calls, context, eventLog, eventLogCalls, repoCacheCalls, repoCacheManager } = createContext();
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventLog,
    repoCacheManager,
    runtime: { webhookSecret: "shared-secret" },
    signature: { isValid: async () => false },
  });

  await handler.handle(context);

  assert.equal(eventLogCalls[0].method, "logReception");
  assert.deepEqual(repoCacheCalls, []);
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
  const { calls, context, eventLog, eventLogCalls, repoCacheManager } = createContext({ path: "/other" });
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventLog,
    repoCacheManager,
    runtime: { webhookSecret: "shared-secret" },
    signature: { isValid: async () => true },
  });

  await handler.handle(context);

  assert.deepEqual(calls, []);
  assert.deepEqual(eventLogCalls, []);
});

test("webhook handler rejects invalid json after signature validation", async () => {
  const { calls, context, eventLog, eventLogCalls, repoCacheCalls, repoCacheManager } = createContext({
    body: "{invalid-json",
  });
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventLog,
    repoCacheManager,
    runtime: { webhookSecret: "shared-secret" },
    signature: { isValid: async () => true },
  });

  await handler.handle(context);

  assert.equal(eventLogCalls[0].method, "logReception");
  assert.deepEqual(repoCacheCalls, []);
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

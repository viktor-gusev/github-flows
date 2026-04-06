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
  const loggingContext = {
    eventId: "delivery-123",
    eventType: "issues",
    logDirectory: "/tmp/github-flows/log/run/octocat/demo/issues/delivery-123",
    owner: "octocat",
    repo: "demo",
  };
  const startCalls = [];
  const resolveCalls = [];

  return {
    calls,
    eventLogCalls,
    startCalls,
    resolveCalls,
    eventLog: {
      logReception(entry) {
        eventLogCalls.push({ method: "logReception", entry });
      },
      async logEventProcessing(entry) {
        eventLogCalls.push({ method: "logEventProcessing", entry });
      },
      logIngress(entry) {
        eventLogCalls.push({ method: "logIngress", entry });
      },
      async logDecisionTrace(entry) {
        eventLogCalls.push({ method: "logDecisionTrace", entry });
      },
      async persistEffectiveProfile(entry) {
        eventLogCalls.push({ method: "persistEffectiveProfile", entry });
      },
      async persistEventSnapshot(entry) {
        eventLogCalls.push({ method: "persistEventSnapshot", entry });
      },
    },
    eventLoggingContext: {
      createByGithubEvent() {
        return loggingContext;
      },
    },
    executionProfileResolver: {
      async resolveByGithubEvent(entry) {
        resolveCalls.push(entry);
        return {
          applicabilityBasis: {
            action: "opened",
            event: "issues",
            repository: "octocat/demo",
          },
          eventAttributes: {
            action: "opened",
            event: "issues",
            repository: "octocat/demo",
          },
          matchedCandidates: [
            {
              id: "issues/profile.json",
              orderKey: "issues/profile.json",
              specificity: 3,
              trigger: {
                action: "opened",
                event: "issues",
                repository: "octocat/demo",
              },
            },
          ],
          selectedProfile: {
            id: "issues/profile.json",
            orderKey: "issues/profile.json",
            promptRefBaseDir: "issues",
            type: "docker",
            trigger: {
              action: "opened",
              event: "issues",
              repository: "octocat/demo",
            },
            execution: {
              handler: { type: "codex", command: ["node"], args: [], promptRef: "default.md" },
              runtime: { image: "profile-image", setupScript: "true", env: {}, timeoutSec: 30 },
            },
          },
        };
      },
    },
    executionStartCoordinator: {
      async start(entry) {
        startCalls.push(entry);
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
    eventLoggingContext: { createByGithubEvent: () => ({}) },
    executionProfileResolver: { resolveByGithubEvent: async () => ({ selectedProfile: null, matchedCandidates: [], eventAttributes: {}, applicabilityBasis: null }) },
    executionStartCoordinator: { start: async () => ({ attempted: true, completed: true, exit: "success", stderr: "", stdout: "" }) },
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
  const { calls, context, eventLog, eventLogCalls, eventLoggingContext, executionProfileResolver, executionStartCoordinator, resolveCalls, startCalls } = createContext({
    body: JSON.stringify(payload),
  });
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventLog,
    eventLoggingContext,
    executionProfileResolver,
    executionStartCoordinator,
    runtime: { webhookSecret: "shared-secret" },
    signature: { isValid: async () => true },
  });

  await handler.handle(context);

  assert.equal(eventLogCalls[0].method, "logReception");
  assert.deepEqual(resolveCalls, [{
    headers: context.request.headers,
    loggingContext: {
      eventId: "delivery-123",
      eventType: "issues",
      logDirectory: "/tmp/github-flows/log/run/octocat/demo/issues/delivery-123",
      owner: "octocat",
      repo: "demo",
    },
    payload,
  }]);
  assert.deepEqual(startCalls, [{
    event: payload,
    loggingContext: {
      eventId: "delivery-123",
      eventType: "issues",
      logDirectory: "/tmp/github-flows/log/run/octocat/demo/issues/delivery-123",
      owner: "octocat",
      repo: "demo",
    },
    selectedProfile: {
      id: "issues/profile.json",
      orderKey: "issues/profile.json",
      promptRefBaseDir: "issues",
      type: "docker",
      trigger: {
        action: "opened",
        event: "issues",
        repository: "octocat/demo",
      },
      execution: {
        handler: { type: "codex", command: ["node"], args: [], promptRef: "default.md" },
        runtime: { image: "profile-image", setupScript: "true", env: {}, timeoutSec: 30 },
      },
    },
  }]);
  assert.deepEqual(eventLogCalls[1].method, "persistEventSnapshot");
  assert.deepEqual(eventLogCalls[2].method, "logEventProcessing");
  assert.deepEqual(eventLogCalls[3], {
    method: "logDecisionTrace",
    entry: {
      loggingContext: {
        eventId: "delivery-123",
        eventType: "issues",
        logDirectory: "/tmp/github-flows/log/run/octocat/demo/issues/delivery-123",
        owner: "octocat",
        repo: "demo",
      },
      resolutionInputs: {
        action: "opened",
        event: "issues",
        repository: "octocat/demo",
      },
      decisionBasis: {
        applicabilityBasis: {
          action: "opened",
          event: "issues",
          repository: "octocat/demo",
        },
        matchedCandidates: [
          {
            id: "issues/profile.json",
            orderKey: "issues/profile.json",
            specificity: 3,
            trigger: {
              action: "opened",
              event: "issues",
              repository: "octocat/demo",
            },
          },
        ],
        selectedProfile: {
          id: "issues/profile.json",
          orderKey: "issues/profile.json",
          trigger: {
            action: "opened",
            event: "issues",
            repository: "octocat/demo",
          },
        },
      },
      decision: "start",
    },
  });
  assert.deepEqual(eventLogCalls[4].method, "persistEffectiveProfile");
  assert.deepEqual(eventLogCalls[5], {
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
  const { calls, context, eventLog, eventLogCalls, executionProfileResolver, resolveCalls } = createContext();
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventLog,
    eventLoggingContext: { createByGithubEvent: () => ({}) },
    executionProfileResolver,
    executionStartCoordinator: { start: async () => ({ attempted: true, completed: true, exit: "success", stderr: "", stdout: "" }) },
    runtime: { webhookSecret: "shared-secret" },
    signature: { isValid: async () => false },
  });

  await handler.handle(context);

  assert.equal(eventLogCalls[0].method, "logReception");
  assert.deepEqual(resolveCalls, []);
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
  const { calls, context, eventLog, eventLogCalls, executionProfileResolver } = createContext({ path: "/other" });
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventLog,
    eventLoggingContext: { createByGithubEvent: () => ({}) },
    executionProfileResolver,
    executionStartCoordinator: { start: async () => ({ attempted: true, completed: true, exit: "success", stderr: "", stdout: "" }) },
    runtime: { webhookSecret: "shared-secret" },
    signature: { isValid: async () => true },
  });

  await handler.handle(context);

  assert.deepEqual(calls, []);
  assert.deepEqual(eventLogCalls, []);
});

test("webhook handler rejects invalid json after signature validation", async () => {
  const { calls, context, eventLog, eventLogCalls, executionProfileResolver, resolveCalls } = createContext({
    body: "{invalid-json",
  });
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventLog,
    eventLoggingContext: { createByGithubEvent: () => ({}) },
    executionProfileResolver,
    executionStartCoordinator: { start: async () => ({ attempted: true, completed: true, exit: "success", stderr: "", stdout: "" }) },
    runtime: { webhookSecret: "shared-secret" },
    signature: { isValid: async () => true },
  });

  await handler.handle(context);

  assert.equal(eventLogCalls[0].method, "logReception");
  assert.deepEqual(resolveCalls, []);
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

test("webhook handler returns 500 if execution start fails", async () => {
  const payload = {
    action: "opened",
    repository: {
      id: 1,
      name: "demo",
      owner: { login: "octocat" },
    },
  };
  const { calls, context, eventLog, eventLogCalls, eventLoggingContext, executionProfileResolver, resolveCalls, startCalls } = createContext({
    body: JSON.stringify(payload),
  });
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventLog,
    eventLoggingContext,
    executionProfileResolver,
    executionStartCoordinator: {
      async start(entry) {
        startCalls.push(entry);
        throw new Error("runtime failed");
      },
    },
    runtime: { webhookSecret: "shared-secret" },
    signature: { isValid: async () => true },
  });

  await handler.handle(context);

  assert.equal(eventLogCalls[0].method, "logReception");
  assert.equal(resolveCalls.length, 1);
  assert.equal(startCalls.length, 1);
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

test("webhook handler skips execution when no profile matches", async () => {
  const payload = {
    action: "opened",
    repository: {
      id: 1,
      name: "demo",
      owner: { login: "octocat" },
    },
  };
  const { calls, context, eventLog, eventLogCalls, eventLoggingContext, executionStartCoordinator, startCalls } = createContext({
    body: JSON.stringify(payload),
  });
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventLog,
    eventLoggingContext,
    executionProfileResolver: {
      async resolveByGithubEvent() {
        return {
          applicabilityBasis: null,
          eventAttributes: {
            action: "opened",
            event: "issues",
            repository: "octocat/demo",
          },
          matchedCandidates: [],
          selectedProfile: null,
        };
      },
    },
    executionStartCoordinator,
    runtime: { webhookSecret: "shared-secret" },
    signature: { isValid: async () => true },
  });

  await handler.handle(context);

  assert.equal(eventLogCalls[0].method, "logReception");
  assert.deepEqual(startCalls, []);
  assert.equal(eventLogCalls[1].method, "persistEventSnapshot");
  assert.equal(eventLogCalls[2].method, "logEventProcessing");
  assert.deepEqual(eventLogCalls[3], {
    method: "logDecisionTrace",
    entry: {
      loggingContext: {
        eventId: "delivery-123",
        eventType: "issues",
        logDirectory: "/tmp/github-flows/log/run/octocat/demo/issues/delivery-123",
        owner: "octocat",
        repo: "demo",
      },
      resolutionInputs: {
        action: "opened",
        event: "issues",
        repository: "octocat/demo",
      },
      decisionBasis: {
        applicabilityBasis: null,
        matchedCandidates: [],
        selectedProfile: null,
      },
      decision: "skip",
    },
  });
  assert.equal(eventLogCalls[4].method, "logEventProcessing");
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

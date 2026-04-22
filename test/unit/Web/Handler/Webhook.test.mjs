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
  const eventModel = {
    action: "opened",
    actorLogin: "flancer64",
    deliveryId: "delivery-123",
    event: "issues",
    repository: {
      fullName: "octocat/demo",
      name: "demo",
      ownerLogin: "octocat",
    },
  };
  const loggingContext = {
    eventId: "delivery-123",
    eventType: "issues",
    logDirectory: "/tmp/github-flows/log/run/octocat/demo/delivery-123",
    owner: "octocat",
    repo: "demo",
  };
  const startCalls = [];
  const attributeResolveCalls = [];
  const eventModelBuildCalls = [];
  const profileResolveCalls = [];

  return {
    attributeResolveCalls,
    calls,
    eventModel,
    eventModelBuildCalls,
    eventLogCalls,
    profileResolveCalls,
    startCalls,
    eventModelBuilder: {
      buildByGithubEvent(entry) {
        eventModelBuildCalls.push(entry);
        return {
          attributes: {
            action: "opened",
            actorLogin: "flancer64",
            event: "issues",
            repository: "octocat/demo",
          },
          event: eventModel,
        };
      },
    },
    eventAttributeResolver: {
      async resolveByGithubEvent(entry) {
        attributeResolveCalls.push(entry);
        return {
          additionalAttributes: {
            issueAuthor: "octocat",
          },
          baseAttributes: {
            action: "opened",
            actorLogin: "flancer64",
            event: "issues",
            repository: "octocat/demo",
          },
          eventModel,
          eventAttributes: {
            action: "opened",
            actorLogin: "flancer64",
            event: "issues",
            issueAuthor: "octocat",
            repository: "octocat/demo",
          },
          providerUsed: true,
        };
      },
    },
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
      createByEventModel(entry) {
        assert.deepEqual(entry, eventModel);
        return loggingContext;
      },
    },
    executionProfileResolver: {
      async resolveByEventAttributes(entry) {
        profileResolveCalls.push(entry);
        return {
          applicabilityBasis: {
            action: "opened",
            event: "issues",
            issueAuthor: "octocat",
            repository: "octocat/demo",
          },
          matchedCandidates: [
            {
              id: "issues/profile.json",
              orderKey: "issues/profile.json",
              specificity: 4,
              trigger: {
                action: "opened",
                event: "issues",
                issueAuthor: "octocat",
                repository: "octocat/demo",
              },
            },
          ],
          selectedProfile: {
            id: "issues/profile.json",
            orderKey: "issues/profile.json",
            promptRefBaseDir: "issues",
            trigger: {
              action: "opened",
              event: "issues",
              issueAuthor: "octocat",
              repository: "octocat/demo",
            },
            execution: {
              handler: { type: "agent", command: ["node"], args: [], promptRef: "default.md" },
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
    eventModelBuilder: { buildByGithubEvent: () => ({ attributes: {}, event: {} }) },
    eventAttributeResolver: { resolveByGithubEvent: async () => ({ additionalAttributes: {}, baseAttributes: {}, eventAttributes: {}, providerUsed: false }) },
    eventLog: {},
    eventLoggingContext: { createByEventModel: () => ({}) },
    executionProfileResolver: { resolveByEventAttributes: async () => ({ selectedProfile: null, matchedCandidates: [], applicabilityBasis: null }) },
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

test("webhook handler resolves event attributes before profile selection", async () => {
  const payload = {
    action: "opened",
    repository: {
      id: 1,
      name: "demo",
      owner: { login: "octocat" },
    },
    sender: {
      login: "flancer64",
    },
  };
  const {
    attributeResolveCalls,
    calls,
    context,
    eventAttributeResolver,
    eventModel,
    eventModelBuildCalls,
    eventModelBuilder,
    eventLog,
    eventLogCalls,
    eventLoggingContext,
    executionProfileResolver,
    executionStartCoordinator,
    profileResolveCalls,
    startCalls,
  } = createContext({
    body: JSON.stringify(payload),
  });
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventModelBuilder,
    eventAttributeResolver,
    eventLog,
    eventLoggingContext,
    executionProfileResolver,
    executionStartCoordinator,
    runtime: { webhookSecret: "shared-secret" },
    signature: { isValid: async () => true },
  });

  await handler.handle(context);

  assert.equal(eventLogCalls[0].method, "logReception");
  assert.deepEqual(eventModelBuildCalls, [{
    headers: context.request.headers,
    payload,
  }]);
  assert.deepEqual(attributeResolveCalls, [{
    eventModel,
    loggingContext: {
      eventId: "delivery-123",
      eventType: "issues",
      logDirectory: "/tmp/github-flows/log/run/octocat/demo/delivery-123",
      owner: "octocat",
      repo: "demo",
    },
    payload,
  }]);
  assert.deepEqual(profileResolveCalls, [{
    eventAttributes: {
      action: "opened",
      actorLogin: "flancer64",
      event: "issues",
      issueAuthor: "octocat",
      repository: "octocat/demo",
    },
    loggingContext: {
      eventId: "delivery-123",
      eventType: "issues",
      logDirectory: "/tmp/github-flows/log/run/octocat/demo/delivery-123",
      owner: "octocat",
      repo: "demo",
    },
  }]);
  assert.deepEqual(startCalls, [{
    event: payload,
    loggingContext: {
      eventId: "delivery-123",
      eventType: "issues",
      logDirectory: "/tmp/github-flows/log/run/octocat/demo/delivery-123",
      owner: "octocat",
      repo: "demo",
    },
    selectedProfile: {
      id: "issues/profile.json",
      orderKey: "issues/profile.json",
      promptRefBaseDir: "issues",
      trigger: {
        action: "opened",
        event: "issues",
        issueAuthor: "octocat",
        repository: "octocat/demo",
      },
      execution: {
        handler: { type: "agent", command: ["node"], args: [], promptRef: "default.md" },
        runtime: { image: "profile-image", setupScript: "true", env: {}, timeoutSec: 30 },
      },
    },
  }]);
  assert.equal(eventLogCalls[1].method, "persistEventSnapshot");
  assert.equal(eventLogCalls[2].method, "logEventProcessing");
  assert.deepEqual(eventLogCalls[3], {
    method: "logEventProcessing",
    entry: {
      action: "resolve-event-attributes",
      component: "Github_Flows_Event_Attribute_Resolver",
      details: {
        additionalAttributes: {
          issueAuthor: "octocat",
        },
        baseAttributes: {
          action: "opened",
          actorLogin: "flancer64",
          event: "issues",
          repository: "octocat/demo",
        },
        eventAttributes: {
          action: "opened",
          actorLogin: "flancer64",
          event: "issues",
          issueAuthor: "octocat",
          repository: "octocat/demo",
        },
        providerUsed: true,
      },
      loggingContext: {
        eventId: "delivery-123",
        eventType: "issues",
        logDirectory: "/tmp/github-flows/log/run/octocat/demo/delivery-123",
        owner: "octocat",
        repo: "demo",
      },
      message: "Resolved additional event attributes for admitted event delivery-123.",
      stage: "attribute-enrichment",
    },
  });
  assert.deepEqual(eventLogCalls[4], {
    method: "logDecisionTrace",
    entry: {
      loggingContext: {
        eventId: "delivery-123",
        eventType: "issues",
        logDirectory: "/tmp/github-flows/log/run/octocat/demo/delivery-123",
        owner: "octocat",
        repo: "demo",
      },
      resolutionInputs: {
        action: "opened",
        actorLogin: "flancer64",
        event: "issues",
        issueAuthor: "octocat",
        repository: "octocat/demo",
      },
      decisionBasis: {
        applicabilityBasis: {
          action: "opened",
          event: "issues",
          issueAuthor: "octocat",
          repository: "octocat/demo",
        },
        matchedCandidates: [
          {
            id: "issues/profile.json",
            orderKey: "issues/profile.json",
            specificity: 4,
            trigger: {
              action: "opened",
              event: "issues",
              issueAuthor: "octocat",
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
            issueAuthor: "octocat",
            repository: "octocat/demo",
          },
        },
      },
      decision: "start",
    },
  });
  assert.equal(eventLogCalls[5].method, "persistEffectiveProfile");
  assert.deepEqual(eventLogCalls[6], {
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
  const { calls, context, eventAttributeResolver, eventLog, eventLogCalls, eventModelBuilder, executionProfileResolver, profileResolveCalls } = createContext();
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventModelBuilder,
    eventAttributeResolver,
    eventLog,
    eventLoggingContext: { createByEventModel: () => ({}) },
    executionProfileResolver,
    executionStartCoordinator: { start: async () => ({ attempted: true, completed: true, exit: "success", stderr: "", stdout: "" }) },
    runtime: { webhookSecret: "shared-secret" },
    signature: { isValid: async () => false },
  });

  await handler.handle(context);

  assert.equal(eventLogCalls[0].method, "logReception");
  assert.deepEqual(profileResolveCalls, []);
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
  const { calls, context, eventAttributeResolver, eventLog, eventLogCalls, eventModelBuilder, executionProfileResolver } = createContext({ path: "/other" });
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventModelBuilder,
    eventAttributeResolver,
    eventLog,
    eventLoggingContext: { createByEventModel: () => ({}) },
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
  const { calls, context, eventAttributeResolver, eventLog, eventLogCalls, eventModelBuilder, executionProfileResolver, profileResolveCalls } = createContext({
    body: "{invalid-json",
  });
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventModelBuilder,
    eventAttributeResolver,
    eventLog,
    eventLoggingContext: { createByEventModel: () => ({}) },
    executionProfileResolver,
    executionStartCoordinator: { start: async () => ({ attempted: true, completed: true, exit: "success", stderr: "", stdout: "" }) },
    runtime: { webhookSecret: "shared-secret" },
    signature: { isValid: async () => true },
  });

  await handler.handle(context);

  assert.equal(eventLogCalls[0].method, "logReception");
  assert.deepEqual(profileResolveCalls, []);
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
  const {
    calls,
    context,
    eventAttributeResolver,
    eventLog,
    eventLogCalls,
    eventModelBuilder,
    eventLoggingContext,
    executionProfileResolver,
    startCalls,
  } = createContext({
    body: JSON.stringify(payload),
  });
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventModelBuilder,
    eventAttributeResolver,
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
  const {
    calls,
    context,
    eventAttributeResolver,
    eventLog,
    eventLogCalls,
    eventModelBuilder,
    eventLoggingContext,
    executionStartCoordinator,
    startCalls,
  } = createContext({
    body: JSON.stringify(payload),
  });
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventModelBuilder,
    eventAttributeResolver,
    eventLog,
    eventLoggingContext,
    executionProfileResolver: {
      async resolveByEventAttributes() {
        return {
          applicabilityBasis: null,
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
  assert.equal(eventLogCalls[3].method, "logEventProcessing");
  assert.deepEqual(eventLogCalls[4], {
    method: "logDecisionTrace",
    entry: {
      loggingContext: {
        eventId: "delivery-123",
        eventType: "issues",
        logDirectory: "/tmp/github-flows/log/run/octocat/demo/delivery-123",
        owner: "octocat",
        repo: "demo",
      },
      resolutionInputs: {
        action: "opened",
        actorLogin: "flancer64",
        event: "issues",
        issueAuthor: "octocat",
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
  assert.equal(eventLogCalls[5].method, "logEventProcessing");
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

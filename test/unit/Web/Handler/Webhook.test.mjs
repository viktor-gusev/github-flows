import test from "node:test";
import assert from "node:assert/strict";
import Github_Flows_Web_Handler_Webhook from "../../../../src/Web/Handler/Webhook.mjs";

function createContext({ path = "/webhooks/github", secret = "shared-secret" } = {}) {
  const calls = [];

  return {
    calls,
    context: {
      request: {
        url: path,
        headers: {
          "x-github-webhook-secret": secret,
        },
      },
      response: {
        headersSent: false,
        writeHead(code, headers) {
          calls.push({ method: "writeHead", code, headers });
        },
        end(body) {
          calls.push({ method: "end", body });
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
    runtime: { webhookSecret: "shared-secret" },
  });

  const info = handler.getRegistrationInfo();

  assert.equal(typeof handler.handle, "function");
  assert.equal(info.name, "Github_Flows_Web_Handler_Webhook");
  assert.equal(info.stage, "PROCESS");
  assert.deepEqual(info.before, []);
  assert.deepEqual(info.after, []);
});

test("webhook handler accepts matching webhook requests", async () => {
  const handler = new Github_Flows_Web_Handler_Webhook({
    runtime: { webhookSecret: "shared-secret" },
  });
  const { calls, context } = createContext();

  await handler.handle(context);

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

test("webhook handler rejects invalid secret", async () => {
  const handler = new Github_Flows_Web_Handler_Webhook({
    runtime: { webhookSecret: "shared-secret" },
  });
  const { calls, context } = createContext({ secret: "wrong-secret" });

  await handler.handle(context);

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
  const handler = new Github_Flows_Web_Handler_Webhook({
    runtime: { webhookSecret: "shared-secret" },
  });
  const { calls, context } = createContext({ path: "/other" });

  await handler.handle(context);

  assert.deepEqual(calls, []);
});

import assert from "node:assert/strict";
import test from "node:test";

import Github_Flows_Web_Handler_Webhook_EventLog from "../../../../../src/Web/Handler/Webhook/EventLog.mjs";

function createSink() {
  const entries = [];

  return {
    entries,
    sink: {
      info(entry) {
        entries.push(entry);
      },
    },
  };
}

test("event logger records bounded inbound snapshot without authentication headers", async () => {
  const { entries, sink } = createSink();
  const logger = new Github_Flows_Web_Handler_Webhook_EventLog({ sink });

  logger.logReception({
    pathname: "/webhooks/github",
    request: {
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
        "x-hub-signature-256": "sha256=secret",
        authorization: "Bearer top-secret",
      },
    },
    body: Buffer.from(
      JSON.stringify({
        action: "opened",
        repository: {
          full_name: "owner/repo",
          description: "x".repeat(65),
        },
      }),
      "utf8",
    ),
  });

  assert.deepEqual(entries, [
    {
      type: "github-webhook",
      stage: "reception",
      pathname: "/webhooks/github",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
      },
      body: {
        action: "opened",
        repository: {
          full_name: "owner/repo",
          description: "...",
        },
      },
    },
  ]);
});

test("event logger records bounded decision trace", async () => {
  const { entries, sink } = createSink();
  const logger = new Github_Flows_Web_Handler_Webhook_EventLog({ sink });

  logger.logDecisionTrace({
    resolutionInputs: {
      eventName: "pull_request",
      repository: "owner/repo",
    },
    decisionBasis: {
      start: true,
      prompt: "x".repeat(80),
    },
    decision: "start",
  });

  assert.deepEqual(entries, [
    {
      type: "github-webhook",
      stage: "decision-trace",
      resolutionInputs: {
        eventName: "pull_request",
        repository: "owner/repo",
      },
      decisionBasis: {
        start: true,
        prompt: "...",
      },
      decision: "start",
    },
  ]);
});

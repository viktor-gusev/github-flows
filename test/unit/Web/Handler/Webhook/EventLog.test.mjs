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
        "x-github-delivery": "12345",
        "x-hub-signature-256": "sha256=secret",
        "x-request-id": "req-1",
        authorization: "Bearer top-secret",
      },
    },
    body: Buffer.from(
      JSON.stringify({
        action: "opened",
        repository: {
          full_name: "owner/repo",
          events_url: "https://api.github.com/users/flancer64/events{/privacy}",
          description: "x".repeat(65),
          owner: {
            login: "octocat",
            profile: {
              bio: "y".repeat(80),
            },
          },
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
        "x-github-event": "issues",
        "x-github-delivery": "12345",
      },
      body: {
        action: "opened",
        repository: {
          full_name: "owner/repo",
          events_url: "...",
          description: "...",
          owner: {
            login: "octocat",
            profile: {
              bio: "...",
            },
          },
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
      installation: {
        account: {
          login: "octocat",
          events_url: "https://api.github.com/users/flancer64/events{/privacy}",
          note: "z".repeat(90),
        },
      },
    },
    decisionBasis: {
      start: true,
      prompt: "x".repeat(80),
      match: {
        repository: {
          name: "repo",
          owner: "owner",
        },
      },
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
        installation: {
          account: {
            login: "octocat",
            events_url: "...",
            note: "...",
          },
        },
      },
      decisionBasis: {
        start: true,
        prompt: "...",
        match: {
          repository: {
            name: "repo",
            owner: "owner",
          },
        },
      },
      decision: "start",
    },
  ]);
});

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import Github_Flows_Web_Handler_Webhook_EventLog from "../../../../../src/Web/Handler/Webhook/EventLog.mjs";

function createSink() {
  const entries = [];

  return {
    entries,
    logger: {
      info(entry) {
        entries.push(entry);
      },
    },
  };
}

test("event logger records bounded inbound snapshot without authentication headers", async () => {
  const { entries, logger: backendLogger } = createSink();
  const logger = new Github_Flows_Web_Handler_Webhook_EventLog({ fsPromises: fs, logger: backendLogger, pathModule: path });

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
  const { entries, logger: backendLogger } = createSink();
  const logger = new Github_Flows_Web_Handler_Webhook_EventLog({ fsPromises: fs, logger: backendLogger, pathModule: path });

  await logger.logDecisionTrace({
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

test("event logger preserves nested structure in default console output", async () => {
  const calls = [];
  const originalInfo = console.info;
  console.info = function (entry) {
    calls.push(entry);
  };

  try {
    const logger = new Github_Flows_Web_Handler_Webhook_EventLog({ fsPromises: fs, pathModule: path });

    await logger.logDecisionTrace({
      resolutionInputs: {
        repository: {
          owner: {
            login: "octocat",
          },
        },
      },
      decisionBasis: {
        match: {
          repository: {
            name: "repo",
          },
        },
      },
      decision: "start",
    });
  } finally {
    console.info = originalInfo;
  }

  assert.equal(typeof calls[0], "string");
  assert.match(calls[0], /"resolutionInputs"/);
  assert.match(calls[0], /"owner"/);
  assert.match(calls[0], /"decisionBasis"/);
  assert.doesNotMatch(calls[0], /\[Object\]/);
});

test("event logger persists archival artifacts for admitted events", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-event-log-"));
  const { entries, logger: backendLogger } = createSink();
  const logger = new Github_Flows_Web_Handler_Webhook_EventLog({ fsPromises: fs, logger: backendLogger, pathModule: path });
  const loggingContext = {
    eventId: "evt-1",
    eventType: "issues",
    logDirectory: path.join(workspaceRoot, "log", "run", "octocat", "demo", "issues", "evt-1"),
    owner: "octocat",
    repo: "demo",
  };

  try {
    await logger.persistEventSnapshot({
      headers: {
        "x-github-event": "issues",
        "x-github-delivery": "evt-1",
        "x-hub-signature-256": "sha256=secret",
      },
      loggingContext,
      payload: {
        action: "opened",
        repository: {
          name: "demo",
          owner: { login: "octocat" },
        },
      },
    });
    await logger.logEventProcessing({
      action: "admitted-event-snapshot",
      component: "Github_Flows_Web_Handler_Webhook",
      details: { eventId: "evt-1" },
      loggingContext,
      message: "Initialized event-scoped archival logging.",
      stage: "admission",
    });
    await logger.persistEffectiveProfile({
      loggingContext,
      selectedProfile: {
        id: "issues/profile.json",
        orderKey: "issues/profile.json",
        promptRefBaseDir: "issues",
        trigger: { event: "issues" },
        type: "docker",
        execution: {
          handler: { type: "codex", command: ["node"], args: [], promptRef: "default.md" },
          runtime: { image: "codex-agent", setupScript: "true", env: {}, timeoutSec: 30 },
        },
      },
    });
    await logger.logDecisionTrace({
      decision: "start",
      decisionBasis: { selectedProfile: { id: "issues/profile.json" } },
      loggingContext,
      resolutionInputs: { event: "issues", repository: "octocat/demo" },
    });

    const eventJson = JSON.parse(await fs.readFile(path.join(loggingContext.logDirectory, "event.json"), "utf8"));
    const effectiveProfileJson = JSON.parse(await fs.readFile(path.join(loggingContext.logDirectory, "effective-profile.json"), "utf8"));
    const eventsLog = (await fs.readFile(path.join(loggingContext.logDirectory, "events.log"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    assert.deepEqual(eventJson, {
      body: {
        action: "opened",
        repository: {
          name: "demo",
          owner: { login: "octocat" },
        },
      },
      headers: {
        "x-github-delivery": "evt-1",
        "x-github-event": "issues",
      },
    });
    assert.equal(effectiveProfileJson.id, "issues/profile.json");
    assert.equal(eventsLog.length, 2);
    assert.equal(eventsLog[0].action, "admitted-event-snapshot");
    assert.equal(eventsLog[1].stage, "decision-trace");
    assert.equal(entries.length, 1);
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

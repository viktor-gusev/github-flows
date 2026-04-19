import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import Github_Flows_Event_Logging_Context from "../../../../src/Event/Logging/Context.mjs";

test("event logging context derives archival scope from admitted github event", () => {
  const factory = new Github_Flows_Event_Logging_Context({
    nowFactory: () => new Date("2026-04-06T08:09:10.000Z"),
    pathModule: path,
    randomIntFactory: () => 42,
    runtime: { workspaceRoot: "/tmp/github-flows" },
  });

  const result = factory.createByGithubEvent({
    headers: {
      "x-github-delivery": "delivery-123",
      "x-github-event": "pull_request",
    },
    payload: {
      action: "opened",
      repository: {
        name: "demo",
        owner: { login: "octocat" },
      },
    },
  });

  assert.deepEqual(result, {
    eventId: "delivery-123",
    eventType: "pull_request",
    logDirectory: "/tmp/github-flows/log/run/octocat/demo/delivery-123",
    owner: "octocat",
    repo: "demo",
  });
});

test("event logging context falls back to generated event id when delivery header is missing", () => {
  const factory = new Github_Flows_Event_Logging_Context({
    nowFactory: () => new Date("2026-04-06T08:09:10.000Z"),
    pathModule: path,
    randomIntFactory: () => 42,
    runtime: { workspaceRoot: "/tmp/github-flows" },
  });

  const result = factory.createByGithubEvent({
    headers: {
      "x-github-event": "issues",
    },
    payload: {
      action: "opened",
      repository: {
        name: "demo",
        owner: { login: "octocat" },
      },
    },
  });

  assert.equal(result.eventId, "260406-080910-0042");
  assert.equal(result.logDirectory, "/tmp/github-flows/log/run/octocat/demo/260406-080910-0042");
});

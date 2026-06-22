import assert from "node:assert/strict";
import test from "node:test";

import Github_Flows_Logger from "../../src/Logger.mjs";

test("package logger records component actions through injected sink", async () => {
  const entries = [];
  const logger = new Github_Flows_Logger({
    sink: {
      info(entry) {
        entries.push(entry);
      },
    },
  });

  logger.logComponentAction({
    component: "Github_Flows_Repo_Cache_Manager",
    action: "clone",
    details: {
      repo: "owner/repo",
      path: "/tmp/workspace/cache/repo/owner/repo",
    },
    message: "Cloned repository cache for owner/repo.",
  });

  assert.equal(entries.length, 1);
  const entry = entries[0];
  assert.equal(entry.type, "github-flows");
  assert.equal(entry.stage, "component-action");
  assert.equal(entry.component, "Github_Flows_Repo_Cache_Manager");
  assert.equal(entry.action, "clone");
  assert.deepEqual(entry.details, {
    repo: "owner/repo",
    path: "/tmp/workspace/cache/repo/owner/repo",
  });
  assert.equal(entry.message, "Cloned repository cache for owner/repo.");
  assert.equal(typeof entry.loggedAt, "string");
  assert.match(entry.loggedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

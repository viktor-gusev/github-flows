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

  assert.deepEqual(entries, [
    {
      type: "github-flows",
      stage: "component-action",
      component: "Github_Flows_Repo_Cache_Manager",
      action: "clone",
      details: {
        repo: "owner/repo",
        path: "/tmp/workspace/cache/repo/owner/repo",
      },
      message: "Cloned repository cache for owner/repo.",
    },
  ]);
});

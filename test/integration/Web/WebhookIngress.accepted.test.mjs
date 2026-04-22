import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  createLogger,
  createProductHarness,
  createRequest,
  createWorkspace,
  installFakeDocker,
  installFakeGh,
  installFakeGit,
  writeProfile,
  writePrompt,
} from "./_helpers.mjs";

test("webhook ingress accepts an agent profile with promptRef", { concurrency: false, timeout: 5000 }, async () => {
  const workspaceRoot = await createWorkspace();
  const fakeStateDir = path.join(workspaceRoot, "fake-bin-state");
  const fakeGhDir = await installFakeGh(workspaceRoot);
  const fakeGitDir = await installFakeGit(workspaceRoot);
  const fakeDockerDir = await installFakeDocker(workspaceRoot);
  const originalPath = process.env.PATH;
  const originalStateDir = process.env.FAKE_BIN_STATE_DIR;
  const secret = "shared-secret";
  const calls = [];
  const logger = createLogger(calls);

  process.env.PATH = `${fakeDockerDir}:${fakeGitDir}:${fakeGhDir}:${originalPath ?? ""}`;
  process.env.FAKE_BIN_STATE_DIR = fakeStateDir;

  try {
    await writeProfile(workspaceRoot, "issues", {
      trigger: {
        event: "issues",
        repository: "octocat/demo",
        action: "opened",
      },
      execution: {
        handler: {
          type: "agent",
          command: ["node"],
          args: [],
          promptRef: "default.md",
          promptVariables: {
            ISSUE_TITLE: "event.issue.title",
          },
        },
        runtime: {
          dockerArgs: [],
          image: "profile-image",
          setupScript: "true",
          env: {},
          timeoutSec: 30,
        },
      },
    });
    await writePrompt(workspaceRoot, path.join("issues", "default.md"), "Issue {{ISSUE_TITLE}}");

    const { handler } = await createProductHarness({
      logger,
      workspaceRoot,
    });
    const request = createRequest(JSON.stringify({
      action: "opened",
      issue: {
        number: 42,
        title: "Integration issue",
      },
      repository: {
        id: 1,
        name: "demo",
        owner: { login: "octocat" },
      },
    }), secret, { deliveryId: "evt-1" });
    const responseCalls = [];
    const response = {
      headersSent: false,
      writeHead(code, headers) {
        responseCalls.push({ method: "writeHead", code, headers });
      },
      end(bodyText) {
        responseCalls.push({ method: "end", body: bodyText });
      },
    };
    const context = {
      request,
      response,
      complete() {
        responseCalls.push({ method: "complete" });
      },
    };

    await handler.handle(context);

    assert.deepEqual(responseCalls, [
      { method: "writeHead", code: 202, headers: { "Content-Type": "application/json; charset=utf-8" } },
      { method: "end", body: JSON.stringify({ status: "accepted" }) },
      { method: "complete" },
    ]);
    await assert.doesNotReject(fs.stat(path.resolve(workspaceRoot, "cache", "repo", "octocat", "demo", ".git")));
    await assert.doesNotReject(fs.stat(path.resolve(workspaceRoot, "ws", "octocat", "demo", "issues", "evt-1")));
    await assert.doesNotReject(fs.readFile(path.join(fakeStateDir, "commands.log"), "utf8"));
  } finally {
    process.env.PATH = originalPath;
    process.env.FAKE_BIN_STATE_DIR = originalStateDir;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

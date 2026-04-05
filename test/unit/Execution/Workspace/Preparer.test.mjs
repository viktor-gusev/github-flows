import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import Github_Flows_Execution_Workspace_Preparer from "../../../../src/Execution/Workspace/Preparer.mjs";

test("workspace preparer creates execution workspace and clones repository from cache", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-ws-"));
  const cachePath = path.resolve(workspaceRoot, "cache", "repo", "octocat", "demo");
  const calls = [];
  const logCalls = [];
  const preparer = new Github_Flows_Execution_Workspace_Preparer({
    childProcess: {
      execFile(command, args, callback) {
        calls.push({ command, args });
        if ((command === "git") && (args[2] === "remote") && (args[3] === "get-url")) {
          callback(null, "git@github.com:octocat/demo.git\n", "");
          return;
        }
        callback(null, "", "");
      },
    },
    logger: {
      logComponentAction(entry) {
        logCalls.push(entry);
      },
    },
    fsPromises: fs,
    nowFactory: () => new Date("2026-04-04T10:11:12.000Z"),
    pathModule: path,
    randomIntFactory: () => 7,
    repoCacheManager: {
      async syncByGithubEvent() {
        return { path: cachePath };
      },
    },
    runtime: { workspaceRoot },
  });

  try {
    const result = await preparer.prepareByGithubEvent({
      event: {
        eventId: "evt-42",
        eventType: "pull_request/opened",
        repository: {
          id: 42,
          name: "demo",
          owner: { login: "octocat" },
        },
      },
    });

    assert.equal(result.workspaceRoot, workspaceRoot);
    assert.equal(result.workspacePath, path.resolve(workspaceRoot, "ws", "octocat", "demo", "pull_request_opened", "evt-42"));
    assert.equal(result.repoPath, path.resolve(result.workspacePath, "repo"));
    assert.equal(result.repositoryCachePath, cachePath);
    await assert.doesNotReject(fs.stat(result.workspacePath));
    assert.deepEqual(calls, [
      {
        command: "git",
        args: ["clone", "--no-hardlinks", cachePath, path.resolve(result.workspacePath, "repo")],
      },
      {
        command: "git",
        args: ["-C", cachePath, "remote", "get-url", "origin"],
      },
      {
        command: "git",
        args: ["-C", path.resolve(result.workspacePath, "repo"), "remote", "set-url", "origin", "git@github.com:octocat/demo.git"],
      },
    ]);
    assert.deepEqual(logCalls, [
      {
        component: "Github_Flows_Execution_Workspace_Preparer",
        action: "workspace-create",
        details: {
          eventId: "evt-42",
          eventType: "pull_request_opened",
          owner: "octocat",
          repo: "demo",
          workspacePath: path.resolve(workspaceRoot, "ws", "octocat", "demo", "pull_request_opened", "evt-42"),
        },
        message: "Created execution workspace for octocat/demo.",
      },
      {
        component: "Github_Flows_Execution_Workspace_Preparer",
        action: "workspace-repo-clone",
        details: {
          owner: "octocat",
          repo: "demo",
          repositoryCachePath: cachePath,
          repoPath: path.resolve(result.workspacePath, "repo"),
          workspacePath: path.resolve(workspaceRoot, "ws", "octocat", "demo", "pull_request_opened", "evt-42"),
        },
        message: "Cloned repository into execution workspace for octocat/demo.",
      },
    ]);
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("workspace preparer generates fallback event id when payload has no stable event id", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-ws-"));
  const preparer = new Github_Flows_Execution_Workspace_Preparer({
    childProcess: {
      execFile(_command, _args, callback) {
        callback(null, "", "");
      },
    },
    fsPromises: fs,
    nowFactory: () => new Date("2026-04-04T10:11:12.000Z"),
    pathModule: path,
    randomIntFactory: () => 7,
    repoCacheManager: {
      async syncByGithubEvent() {
        return { path: path.resolve(workspaceRoot, "cache", "repo", "octocat", "demo") };
      },
    },
    runtime: { workspaceRoot },
  });

  try {
    const result = await preparer.prepareByGithubEvent({
      event: {
        action: "issues/labeled",
        repository: {
          name: "demo",
          owner: { login: "octocat" },
        },
      },
    });

    assert.equal(result.eventType, "issues_labeled");
    assert.equal(result.eventId, "260404-101112-0007");
    assert.equal(result.workspaceRoot, workspaceRoot);
    assert.equal(result.workspacePath, path.resolve(workspaceRoot, "ws", "octocat", "demo", "issues_labeled", "260404-101112-0007"));
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("workspace preparer rejects reuse of an existing execution workspace path", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-ws-"));
  const existingWorkspace = path.resolve(workspaceRoot, "ws", "octocat", "demo", "push", "evt-1");
  await fs.mkdir(existingWorkspace, { recursive: true });
  const preparer = new Github_Flows_Execution_Workspace_Preparer({
    childProcess: {
      execFile(_command, _args, callback) {
        callback(null, "", "");
      },
    },
    fsPromises: fs,
    pathModule: path,
    repoCacheManager: {
      async syncByGithubEvent() {
        return { path: path.resolve(workspaceRoot, "cache", "repo", "octocat", "demo") };
      },
    },
    runtime: { workspaceRoot },
  });

  try {
    await assert.rejects(
      preparer.prepareByGithubEvent({
        event: {
          eventId: "evt-1",
          eventType: "push",
          repository: {
            name: "demo",
            owner: { login: "octocat" },
          },
        },
      }),
      /already exists/i,
    );
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

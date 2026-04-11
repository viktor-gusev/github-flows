import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import Github_Flows_Repo_Cache_Manager from "../../../../src/Repo/Cache/Manager.mjs";

test("repo cache manager clones missing repository into workspace cache", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-cache-"));
  const calls = [];
  const logCalls = [];
  const manager = new Github_Flows_Repo_Cache_Manager({
    childProcess: {
      execFile(command, args, options, callback) {
        if (typeof options === "function") {
          callback = options;
          options = {};
        }
        calls.push({ command, args });
        callback(null);
      },
    },
    logger: {
      logComponentAction(entry) {
        logCalls.push(entry);
      },
    },
    fsPromises: fs,
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    const result = await manager.syncByGithubEvent({
      event: {
        repository: {
          id: 42,
          name: "demo",
          owner: { login: "octocat" },
        },
      },
    });

    assert.equal(result.action, "clone");
    assert.equal(result.githubRepoId, 42);
    assert.equal(result.owner, "octocat");
    assert.equal(result.repo, "demo");
    assert.equal(result.path, path.resolve(workspaceRoot, "cache", "repo", "octocat", "demo"));
    assert.deepEqual(calls, [
      {
        command: "gh",
        args: [
          "repo",
          "clone",
          "octocat/demo",
          path.resolve(workspaceRoot, "cache", "repo", "octocat", "demo"),
          "--",
          "--depth=1",
          "--single-branch",
          "--no-tags",
        ],
      },
    ]);
    assert.deepEqual(logCalls, [
      {
        component: "Github_Flows_Repo_Cache_Manager",
        action: "clone",
        details: {
          owner: "octocat",
          path: path.resolve(workspaceRoot, "cache", "repo", "octocat", "demo"),
          repo: "demo",
        },
        message: "Cloned repository cache for octocat/demo.",
      },
    ]);
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("repo cache manager pulls existing repository cache", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-cache-"));
  const repoPath = path.resolve(workspaceRoot, "cache", "repo", "octocat", "demo");
  const calls = [];
  const logCalls = [];
  await fs.mkdir(path.join(repoPath, ".git"), { recursive: true });

  const manager = new Github_Flows_Repo_Cache_Manager({
    childProcess: {
      execFile(command, args, options, callback) {
        if (typeof options === "function") {
          callback = options;
          options = {};
        }
        calls.push({ command, args });
        callback(null);
      },
    },
    logger: {
      logComponentAction(entry) {
        logCalls.push(entry);
      },
    },
    fsPromises: fs,
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    const result = await manager.syncByGithubEvent({
      event: {
        repository: {
          id: 7,
          name: "demo",
          owner: { login: "octocat" },
        },
      },
    });

    assert.equal(result.action, "pull");
    assert.deepEqual(calls, [
      {
        command: "git",
        args: ["-C", repoPath, "pull", "--ff-only", "--depth=1"],
      },
    ]);
    assert.deepEqual(logCalls, [
      {
        component: "Github_Flows_Repo_Cache_Manager",
        action: "pull",
        details: {
          owner: "octocat",
          path: repoPath,
          repo: "demo",
        },
        message: "Updated repository cache for octocat/demo.",
      },
    ]);
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("repo cache manager rejects payloads without repository identity", async () => {
  const manager = new Github_Flows_Repo_Cache_Manager({
    childProcess: {
      execFile(_command, _args, _options, callback) {
        if (typeof _options === "function") {
          callback = _options;
        }
        callback(new Error("must not be called"));
      },
    },
    fsPromises: fs,
    pathModule: path,
    runtime: { workspaceRoot: "/tmp/github-flows" },
  });

  await assert.rejects(
    manager.syncByGithubEvent({
      event: { repository: { owner: { login: "octocat" } } },
    }),
    /repository name is missing/i,
  );
});

test("repo cache manager passes git auth env when host token is present", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-cache-"));
  const originalToken = process.env.GH_TOKEN;
  process.env.GH_TOKEN = "ghp_test-token";
  let seenOptions;

  const manager = new Github_Flows_Repo_Cache_Manager({
    childProcess: {
      execFile(_command, _args, options, callback) {
        if (typeof options === "function") {
          callback = options;
          options = {};
        }
        seenOptions = options;
        callback(null);
      },
    },
    fsPromises: fs,
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    await manager.syncByGithubEvent({
      event: {
        repository: {
          id: 1,
          name: "demo",
          owner: { login: "octocat" },
        },
      },
    });

    assert.equal(seenOptions.env.GIT_TERMINAL_PROMPT, "0");
    assert.equal(seenOptions.env.GIT_CONFIG_KEY_0, "credential.helper");
    assert.equal(seenOptions.env.GH_TOKEN, "ghp_test-token");
  } finally {
    process.env.GH_TOKEN = originalToken;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

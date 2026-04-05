import assert from "node:assert/strict";
import test from "node:test";

import Github_Flows_Execution_Launch_Contract_Factory from "../../../../../src/Execution/Launch/Contract/Factory.mjs";

test("launch contract factory creates fully resolved contract from explicit profile and workspace", () => {
  const factory = new Github_Flows_Execution_Launch_Contract_Factory({});

  const contract = factory.create({
    prompt: "Solve the task.",
    selectedProfile: {
      id: "issues/profile.json",
      orderKey: "issues/profile.json",
      promptRefBaseDir: "issues",
      trigger: { event: "issues" },
      type: "docker",
      launch: {
        handler: {
          type: "codex",
          command: ["node", "bin/agent.mjs"],
          args: ["--mode", "run"],
          promptRef: "default.md",
        },
        runtime: {
          image: "codex-agent",
          setupScript: "test -d repo",
          env: { DEMO: "1" },
          timeoutSec: 120,
        },
      },
    },
    workspace: {
      eventId: "evt-1",
      eventType: "issues",
      githubRepoId: 1,
      owner: "octocat",
      repo: "demo",
      repoPath: "/tmp/github-flows/ws/octocat/demo/issues/evt-1/repo",
      repositoryCachePath: "/tmp/github-flows/cache/repo/octocat/demo",
      workspaceRoot: "/tmp/github-flows",
      workspacePath: "/tmp/github-flows/ws/octocat/demo/issues/evt-1",
    },
  });

  assert.deepEqual(contract, {
    type: "docker",
    handler: {
      type: "codex",
      command: ["node", "bin/agent.mjs"],
      args: ["--mode", "run"],
      prompt: "Solve the task.",
    },
    environment: {
      image: "codex-agent",
      workspaceRoot: "/tmp/github-flows",
      workspacePath: "/tmp/github-flows/ws/octocat/demo/issues/evt-1",
      setupScript: "test -d repo",
      env: { DEMO: "1" },
      timeoutSec: 120,
    },
  });
});

test("launch contract factory fails when explicit fields are missing", () => {
  const factory = new Github_Flows_Execution_Launch_Contract_Factory({});

  assert.throws(() => factory.create({
    prompt: "Solve the task.",
    selectedProfile: {
      id: "issues/profile.json",
      orderKey: "issues/profile.json",
      promptRefBaseDir: "issues",
      trigger: { event: "issues" },
      type: "docker",
      launch: {
        handler: {
          type: "codex",
          command: ["node"],
          promptRef: "default.md",
        },
        runtime: {
          image: "codex-agent",
          setupScript: "test -d repo",
          env: { DEMO: "1" },
          timeoutSec: 120,
        },
      },
    },
    workspace: {
      workspaceRoot: "/tmp/github-flows",
      workspacePath: "/tmp/github-flows/ws/octocat/demo/issues/evt-1",
    },
  }), /launch\.handler\.args/);
});

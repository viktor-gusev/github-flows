import assert from "node:assert/strict";
import test from "node:test";

import Github_Flows_Execution_Launch_Contract_Factory from "../../../../../src/Execution/Launch/Contract/Factory.mjs";

test("launch contract factory creates fully resolved contract from explicit profile and workspace", () => {
  const factory = new Github_Flows_Execution_Launch_Contract_Factory({ eventLog: {} });

  const contract = factory.create({
    loggingContext: {
      eventId: "evt-1",
      eventType: "issues",
      logDirectory: "/tmp/github-flows/log/run/octocat/demo/issues/evt-1",
      owner: "octocat",
      repo: "demo",
    },
    prompt: "Solve the task.",
    selectedProfile: {
      id: "issues/profile.json",
      orderKey: "issues/profile.json",
      promptRefBaseDir: "issues",
      trigger: { event: "issues" },
      type: "docker",
      execution: {
        handler: {
          type: "codex",
          command: ["node", "bin/agent.mjs"],
          args: ["--mode", "run"],
          promptRef: "default.md",
        },
        runtime: {
          dockerArgs: ["--mount", "type=bind,src=/home/codex/.codex,dst=/home/codex/.codex"],
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
      dockerArgs: ["--mount", "type=bind,src=/home/codex/.codex,dst=/home/codex/.codex"],
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
  const factory = new Github_Flows_Execution_Launch_Contract_Factory({ eventLog: {} });

  assert.throws(() => factory.create({
    loggingContext: {
      eventId: "evt-1",
      eventType: "issues",
      logDirectory: "/tmp/github-flows/log/run/octocat/demo/issues/evt-1",
      owner: "octocat",
      repo: "demo",
    },
    prompt: "Solve the task.",
    selectedProfile: {
      id: "issues/profile.json",
      orderKey: "issues/profile.json",
      promptRefBaseDir: "issues",
      trigger: { event: "issues" },
      type: "docker",
      execution: {
        handler: {
          type: "codex",
          command: ["node"],
          promptRef: "default.md",
        },
        runtime: {
          dockerArgs: ["--mount"],
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
  }), /execution\.handler\.args/);
});

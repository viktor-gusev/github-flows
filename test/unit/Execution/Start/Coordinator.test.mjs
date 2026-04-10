import assert from "node:assert/strict";
import test from "node:test";

import Github_Flows_Execution_Start_Coordinator from "../../../../src/Execution/Start/Coordinator.mjs";

test("execution start coordinator prepares workspace and materializes launch contract from profile", async () => {
  const calls = [];
  const coordinator = new Github_Flows_Execution_Start_Coordinator({
    eventLog: {
      async logEventProcessing(entry) {
        calls.push({ method: "logEventProcessing", entry });
      },
    },
    executionLaunchContractFactory: {
      create(entry) {
        calls.push({ method: "create", entry });
        return {
          type: "docker",
          handler: {
            type: "codex",
            command: ["node", "bin/agent.mjs"],
            args: ["--mode", "run"],
            prompt: "Solve the task.",
          },
          environment: {
            dockerArgs: ["--mount", "type=bind,src=/home/codex/.codex,dst=/home/codex/.codex"],
            image: "profile-image",
            workspaceRoot: "/tmp/github-flows",
            workspacePath: "/tmp/github-flows/ws/octocat/demo/issues/evt-1",
            setupScript: "test -d repo",
            env: { DEMO: "1" },
            timeoutSec: 99,
          },
        };
      },
    },
    executionPromptMaterializer: {
      async materialize(entry) {
        calls.push({ method: "materialize", entry });
        return { prompt: "Solve the task.", promptBindings: { PR_TITLE: "Fix bug" } };
      },
    },
    executionRuntimeDocker: {
      async run(entry) {
        calls.push({ method: "run", entry });
        return { attempted: true, completed: true, exit: "success", stderr: "", stdout: "" };
      },
    },
    executionWorkspacePreparer: {
      async prepareByGithubEvent(entry) {
        calls.push({ method: "prepareByGithubEvent", entry });
        return {
          workspaceRoot: "/tmp/github-flows",
          workspacePath: "/tmp/github-flows/ws/octocat/demo/issues/evt-1",
        };
      },
    },
  });

  const result = await coordinator.start({
    event: { id: "evt-1" },
    loggingContext: {
      eventId: "evt-1",
      eventType: "issues",
      logDirectory: "/tmp/github-flows/log/run/octocat/demo/issues/evt-1",
      owner: "octocat",
      repo: "demo",
    },
    selectedProfile: {
      id: "a/profile.json",
      orderKey: "a/profile.json",
      promptRefBaseDir: "a",
      type: "docker",
      trigger: { event: "issues" },
      execution: {
        handler: {
          type: "codex",
          command: ["node", "bin/agent.mjs"],
          args: ["--mode", "run"],
          promptRef: "default.md",
        },
        runtime: {
          dockerArgs: ["--mount", "type=bind,src=/home/codex/.codex,dst=/home/codex/.codex"],
          image: "profile-image",
          setupScript: "test -d repo",
          env: { DEMO: "1" },
          timeoutSec: 99,
        },
      },
    },
  });

  assert.deepEqual(result, {
    attempted: true,
    completed: true,
    exit: "success",
    stderr: "",
    stdout: "",
  });
  const actions = calls.map((call) => call.method === "logEventProcessing" ? call.entry.action : call.method);
  assert.deepEqual(actions, [
    "execution-start-requested",
    "workspace-prepare-requested",
    "prepareByGithubEvent",
    "workspace-prepared",
    "materialize",
    "create",
    "launch-contract-materialized",
    "runtime-start-requested",
    "run",
    "runtime-completed",
  ]);
});

test("execution start coordinator requires profile runtime image", async () => {
  const coordinator = new Github_Flows_Execution_Start_Coordinator({
    eventLog: { async logEventProcessing() {} },
    executionLaunchContractFactory: {
      create() {
        throw new Error("Missing required launch field: execution.runtime.image");
      },
    },
    executionPromptMaterializer: {
      async materialize() {
        return { prompt: "Solve the task.", promptBindings: {} };
      },
    },
    executionRuntimeDocker: {
      async run() {
        throw new Error("must not run");
      },
    },
    executionWorkspacePreparer: {
      async prepareByGithubEvent() {
        return { workspaceRoot: "/tmp/github-flows", workspacePath: "/tmp/github-flows/ws" };
      },
    },
  });

  await assert.rejects(
    coordinator.start({
      event: {},
      loggingContext: {
        eventId: "evt-1",
        eventType: "issues",
        logDirectory: "/tmp/github-flows/log/run/octocat/demo/issues/evt-1",
        owner: "octocat",
        repo: "demo",
      },
      selectedProfile: {
        id: "a/profile.json",
        orderKey: "a/profile.json",
        promptRefBaseDir: "a",
        type: "docker",
        trigger: {},
        execution: { handler: { type: "codex", promptRef: "default.md" }, runtime: {} },
      },
    }),
    /execution\.runtime\.image/,
  );
});

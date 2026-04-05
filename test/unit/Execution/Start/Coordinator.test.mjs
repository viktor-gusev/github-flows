import assert from "node:assert/strict";
import test from "node:test";

import Github_Flows_Execution_Start_Coordinator from "../../../../src/Execution/Start/Coordinator.mjs";

test("execution start coordinator prepares workspace and materializes launch contract from profile", async () => {
  const calls = [];
  const coordinator = new Github_Flows_Execution_Start_Coordinator({
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
        return "Solve the task.";
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
    selectedProfile: {
      id: "a/profile.json",
      orderKey: "a/profile.json",
      promptRefBaseDir: "a",
      type: "docker",
      trigger: { event: "issues" },
      launch: {
        handler: {
          type: "codex",
          command: ["node", "bin/agent.mjs"],
          args: ["--mode", "run"],
          promptRef: "default.md",
        },
        runtime: {
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
  assert.deepEqual(calls, [
    { method: "prepareByGithubEvent", entry: { event: { id: "evt-1" } } },
    {
      method: "materialize",
      entry: {
        event: { id: "evt-1" },
        selectedProfile: {
          id: "a/profile.json",
          orderKey: "a/profile.json",
          promptRefBaseDir: "a",
          type: "docker",
          trigger: { event: "issues" },
          launch: {
            handler: {
              type: "codex",
              command: ["node", "bin/agent.mjs"],
              args: ["--mode", "run"],
              promptRef: "default.md",
            },
            runtime: {
              image: "profile-image",
              setupScript: "test -d repo",
              env: { DEMO: "1" },
              timeoutSec: 99,
            },
          },
        },
        workspace: {
          workspaceRoot: "/tmp/github-flows",
          workspacePath: "/tmp/github-flows/ws/octocat/demo/issues/evt-1",
        },
      },
    },
    {
      method: "create",
      entry: {
        prompt: "Solve the task.",
        selectedProfile: {
          id: "a/profile.json",
          orderKey: "a/profile.json",
          promptRefBaseDir: "a",
          type: "docker",
          trigger: { event: "issues" },
          launch: {
            handler: {
              type: "codex",
              command: ["node", "bin/agent.mjs"],
              args: ["--mode", "run"],
              promptRef: "default.md",
            },
            runtime: {
              image: "profile-image",
              setupScript: "test -d repo",
              env: { DEMO: "1" },
              timeoutSec: 99,
            },
          },
        },
        workspace: {
          workspaceRoot: "/tmp/github-flows",
          workspacePath: "/tmp/github-flows/ws/octocat/demo/issues/evt-1",
        },
      },
    },
    {
      method: "run",
      entry: {
        launchContract: {
          type: "docker",
          handler: {
            type: "codex",
            command: ["node", "bin/agent.mjs"],
            args: ["--mode", "run"],
            prompt: "Solve the task.",
          },
          environment: {
            image: "profile-image",
            workspaceRoot: "/tmp/github-flows",
            workspacePath: "/tmp/github-flows/ws/octocat/demo/issues/evt-1",
            setupScript: "test -d repo",
            env: { DEMO: "1" },
            timeoutSec: 99,
          },
        },
      },
    },
  ]);
});

test("execution start coordinator requires profile runtime image", async () => {
  const coordinator = new Github_Flows_Execution_Start_Coordinator({
    executionLaunchContractFactory: {
      create() {
        throw new Error("Missing required launch field: launch.runtime.image");
      },
    },
    executionPromptMaterializer: {
      async materialize() {
        return "Solve the task.";
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
      selectedProfile: {
        id: "a/profile.json",
        orderKey: "a/profile.json",
        promptRefBaseDir: "a",
        type: "docker",
        trigger: {},
        launch: { handler: { type: "codex", promptRef: "default.md" }, runtime: {} },
      },
    }),
    /launch\.runtime\.image/,
  );
});

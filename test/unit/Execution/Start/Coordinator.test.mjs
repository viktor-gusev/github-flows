import assert from "node:assert/strict";
import test from "node:test";

import Github_Flows_Execution_Start_Coordinator from "../../../../src/Execution/Start/Coordinator.mjs";

test("execution start coordinator prepares workspace and materializes launch contract from profile", async () => {
  const calls = [];
  const coordinator = new Github_Flows_Execution_Start_Coordinator({
    childProcess: {
      spawn(command, args, options) {
        calls.push({ method: "spawn", entry: { command, args, options } });
        const stdoutListeners = [];
        const stderrListeners = [];
        const closeListeners = [];
        return {
          killed: false,
          stdout: { on(event, listener) { if (event === "data") stdoutListeners.push(listener); } },
          stderr: { on(event, listener) { if (event === "data") stderrListeners.push(listener); } },
          on(event, listener) {
            if (event === "close") closeListeners.push(listener);
          },
          kill() { return true; },
        };
      },
    },
    eventLog: {
      async logEventProcessing(entry) {
        calls.push({ method: "logEventProcessing", entry });
      },
    },
    executionLaunchContractFactory: {
      create(entry) {
        calls.push({ method: "create", entry });
        return {
          handler: {
            type: "agent",
            command: ["node", "bin/agent.mjs"],
            args: ["--mode", "run"],
            prompt: "Solve the task.",
          },
          environment: {
            dockerArgs: ["--mount", "type=bind,src=/home/codex/.codex,dst=/home/codex/.codex"],
            hostScript: "",
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
    hostAttributes: { reviewLane: "priority" },
    loggingContext: {
      eventId: "evt-1",
      eventType: "issues",
      logDirectory: "/tmp/github-flows/log/run/octocat/demo/evt-1",
      owner: "octocat",
      repo: "demo",
    },
    selectedProfile: {
      id: "a/profile.json",
      orderKey: "a/profile.json",
      promptRefBaseDir: "a",
      trigger: { event: "issues" },
      execution: {
        handler: {
          type: "agent",
          command: ["node", "bin/agent.mjs"],
          args: ["--mode", "run"],
          promptRef: "default.md",
        },
        runtime: {
          dockerArgs: ["--mount", "type=bind,src=/home/codex/.codex,dst=/home/codex/.codex"],
          hostScript: "",
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
    "host-script-skipped",
    "runtime-start-requested",
    "run",
    "runtime-completed",
  ]);
  assert.deepEqual(calls.find((call) => call.method === "materialize")?.entry.hostAttributes, {
    reviewLane: "priority",
  });
});

test("execution start coordinator requires profile runtime image", async () => {
  const coordinator = new Github_Flows_Execution_Start_Coordinator({
    childProcess: { spawn() { throw new Error("must not spawn"); } },
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
      hostAttributes: {},
      loggingContext: {
        eventId: "evt-1",
        eventType: "issues",
        logDirectory: "/tmp/github-flows/log/run/octocat/demo/evt-1",
        owner: "octocat",
        repo: "demo",
      },
      selectedProfile: {
        id: "a/profile.json",
        orderKey: "a/profile.json",
        promptRefBaseDir: "a",
        trigger: {},
        execution: { handler: { type: "agent", promptRef: "default.md" }, runtime: {} },
      },
    }),
    /execution\.runtime\.image/,
  );
});

test("execution start coordinator rejects agent profiles without promptRef before preparation", async () => {
  const calls = [];
  const coordinator = new Github_Flows_Execution_Start_Coordinator({
    childProcess: { spawn() { throw new Error("must not spawn"); } },
    eventLog: {
      async logEventProcessing(entry) {
        calls.push({ method: "logEventProcessing", entry });
      },
    },
    executionLaunchContractFactory: {
      create() {
        throw new Error("must not create");
      },
    },
    executionPromptMaterializer: {
      async materialize() {
        throw new Error("must not materialize");
      },
    },
    executionRuntimeDocker: {
      async run() {
        throw new Error("must not run");
      },
    },
    executionWorkspacePreparer: {
      async prepareByGithubEvent() {
        throw new Error("must not prepare");
      },
    },
  });

  await assert.rejects(
    coordinator.start({
      event: {},
      hostAttributes: {},
      loggingContext: {
        eventId: "evt-1",
        eventType: "issues",
        logDirectory: "/tmp/github-flows/log/run/octocat/demo/evt-1",
        owner: "octocat",
        repo: "demo",
      },
      selectedProfile: {
        id: "a/profile.json",
        orderKey: "a/profile.json",
        promptRefBaseDir: "a",
        trigger: {},
        execution: { handler: { type: "agent", command: ["node"], args: [] }, runtime: {} },
      },
    }),
    /execution\.handler\.promptRef/,
  );

  assert.deepEqual(calls, []);
});

test("execution start coordinator runs hostScript before docker runtime and reduces timeout", async () => {
  const calls = [];
  const coordinator = new Github_Flows_Execution_Start_Coordinator({
    childProcess: {
      spawn(command, args, options) {
        calls.push({ method: "spawn", entry: { command, args, options } });
        const stdoutListeners = [];
        const stderrListeners = [];
        const closeListeners = [];
        const processMock = {
          killed: false,
          stdout: { on(event, listener) { if (event === "data") stdoutListeners.push(listener); } },
          stderr: { on(event, listener) { if (event === "data") stderrListeners.push(listener); } },
          on(event, listener) {
            if (event === "close") closeListeners.push(listener);
          },
          kill() {
            processMock.killed = true;
            return true;
          },
        };
        queueMicrotask(() => {
          stdoutListeners.forEach((listener) => listener(Buffer.from("prepared")));
          closeListeners.forEach((listener) => listener(0, null));
        });
        return processMock;
      },
    },
    eventLog: {
      async logEventProcessing(entry) {
        calls.push({ method: "logEventProcessing", entry });
      },
    },
    executionLaunchContractFactory: {
      create() {
        calls.push({ method: "create" });
        return {
          handler: { type: "agent", command: ["node"], args: ["agent.mjs"], prompt: "Solve the task." },
          environment: {
            dockerArgs: [],
            hostScript: "./bin/prepare-host-access.sh",
            image: "profile-image",
            workspaceRoot: "/tmp/github-flows",
            workspacePath: "/tmp/github-flows/ws/octocat/demo/issues/evt-1",
            env: { DEMO: "1" },
            timeoutSec: 99,
          },
        };
      },
    },
    executionPromptMaterializer: {
      async materialize() {
        calls.push({ method: "materialize" });
        return { prompt: "Solve the task.", promptBindings: {} };
      },
    },
    executionRuntimeDocker: {
      async run(entry) {
        calls.push({ method: "run", entry });
        return { attempted: true, completed: true, exit: "success", stderr: "", stdout: "" };
      },
    },
    executionWorkspacePreparer: {
      async prepareByGithubEvent() {
        calls.push({ method: "prepareByGithubEvent" });
        return { workspaceRoot: "/tmp/github-flows", workspacePath: "/tmp/github-flows/ws/octocat/demo/issues/evt-1" };
      },
    },
  });

  await coordinator.start({
    event: { id: "evt-1" },
    loggingContext: {
      eventId: "evt-1",
      eventType: "issues",
      logDirectory: "/tmp/github-flows/log/run/octocat/demo/evt-1",
      owner: "octocat",
      repo: "demo",
    },
    selectedProfile: {
      id: "a/profile.json",
      orderKey: "a/profile.json",
      promptRefBaseDir: "a",
      trigger: { event: "issues" },
      execution: {
        handler: { type: "agent", command: ["node"], args: ["agent.mjs"], promptRef: "default.md" },
        runtime: { image: "profile-image", hostScript: "./bin/prepare-host-access.sh", env: { DEMO: "1" }, timeoutSec: 99 },
      },
    },
  });

  const actions = calls.map((call) => call.method === "logEventProcessing" ? call.entry.action : call.method);
  assert.deepEqual(actions.slice(actions.indexOf("launch-contract-materialized"), actions.indexOf("runtime-completed") + 1), [
    "launch-contract-materialized",
    "host-script-started",
    "spawn",
    "host-script-completed",
    "runtime-start-requested",
    "run",
    "runtime-completed",
  ]);
  const spawnCall = calls.find((call) => call.method === "spawn")?.entry;
  assert.equal(spawnCall.command, "bash");
  assert.deepEqual(spawnCall.args, ["-lc", "./bin/prepare-host-access.sh"]);
  assert.equal(spawnCall.options.cwd, "/tmp/github-flows/ws/octocat/demo/issues/evt-1");
  assert.equal(spawnCall.options.env.DEMO, "1");
  const runtimeCall = calls.find((call) => call.method === "run")?.entry;
  assert.ok(runtimeCall.launchContract.environment.timeoutSec <= 99);
  assert.equal(runtimeCall.launchContract.environment.hostScript, "./bin/prepare-host-access.sh");
});

test("execution start coordinator stops before docker runtime when hostScript fails", async () => {
  const calls = [];
  const coordinator = new Github_Flows_Execution_Start_Coordinator({
    childProcess: {
      spawn() {
        const closeListeners = [];
        const processMock = {
          killed: false,
          stdout: { on() {} },
          stderr: { on() {} },
          on(event, listener) {
            if (event === "close") closeListeners.push(listener);
          },
          kill() { return true; },
        };
        queueMicrotask(() => {
          closeListeners.forEach((listener) => listener(1, null));
        });
        return processMock;
      },
    },
    eventLog: {
      async logEventProcessing(entry) {
        calls.push({ method: "logEventProcessing", entry });
      },
    },
    executionLaunchContractFactory: {
      create() {
        return {
          handler: { type: "agent", command: ["node"], args: ["agent.mjs"], prompt: "Solve the task." },
          environment: {
            dockerArgs: [],
            hostScript: "./bin/fail.sh",
            image: "profile-image",
            workspaceRoot: "/tmp/github-flows",
            workspacePath: "/tmp/github-flows/ws/octocat/demo/issues/evt-1",
            env: {},
            timeoutSec: 99,
          },
        };
      },
    },
    executionPromptMaterializer: { async materialize() { return { prompt: "Solve the task.", promptBindings: {} }; } },
    executionRuntimeDocker: { async run() { throw new Error("must not run"); } },
    executionWorkspacePreparer: { async prepareByGithubEvent() { return { workspaceRoot: "/tmp/github-flows", workspacePath: "/tmp/github-flows/ws/octocat/demo/issues/evt-1" }; } },
  });

  await assert.rejects(() => coordinator.start({
    event: {},
    loggingContext: {
      eventId: "evt-1",
      eventType: "issues",
      logDirectory: "/tmp/github-flows/log/run/octocat/demo/evt-1",
      owner: "octocat",
      repo: "demo",
    },
    selectedProfile: {
      id: "a/profile.json",
      orderKey: "a/profile.json",
      promptRefBaseDir: "a",
      trigger: {},
      execution: {
        handler: { type: "agent", command: ["node"], args: ["agent.mjs"], promptRef: "default.md" },
        runtime: { image: "profile-image", hostScript: "./bin/fail.sh", env: {}, timeoutSec: 99 },
      },
    },
  }), /host script exited with code 1/);
  assert.equal(calls.some((call) => call.method === "logEventProcessing" && call.entry.action === "host-script-failed"), true);
});

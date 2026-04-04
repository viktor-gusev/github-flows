import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import Github_Flows_Execution_Runtime_Docker from "../../../../src/Execution/Runtime/Docker.mjs";

test("docker runtime starts container from launch contract", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-runtime-"));
  const calls = [];
  const logs = [];
  const runtime = new Github_Flows_Execution_Runtime_Docker({
    childProcess: {
      execFile(command, args, options, callback) {
        calls.push({ command, args, options });
        callback(null, "ok", "");
      },
    },
    fsPromises: fs,
    logger: {
      logComponentAction(entry) {
        logs.push(entry);
      },
    },
  });

  try {
    const result = await runtime.run({
      launchContract: {
        agent: {
          type: "codex",
          command: ["node", "bin/agent.mjs"],
          args: ["--mode", "run"],
          prompt: "Solve the task.",
        },
        environment: {
          image: "codex-agent",
          workspacePath,
          setupScript: "test -d repo",
          env: { DEMO: "1" },
          timeoutSec: 1800,
        },
      },
    });

    assert.deepEqual(result, {
      attempted: true,
      completed: true,
      exit: "success",
      stderr: "",
      stdout: "ok",
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, "docker");
    assert.deepEqual(calls[0].options, { timeout: 1800000, killSignal: "SIGKILL" });
    assert.deepEqual(calls[0].args.slice(0, 9), [
      "run",
      "--rm",
      "--init",
      "--workdir",
      "/workspace",
      "--mount",
      `type=bind,src=${workspacePath},dst=/workspace`,
      "--env",
      "DEMO=1",
    ]);
    assert.equal(calls[0].args[9], "codex-agent");
    assert.equal(calls[0].args[10], "bash");
    assert.equal(calls[0].args[11], "-lc");
    assert.match(calls[0].args[12], /cd '\/workspace'/);
    assert.match(calls[0].args[12], /test -d repo/);
    assert.match(calls[0].args[12], /printf %s 'Solve the task\.'/);
    assert.equal(logs[0].action, "docker-run-start");
    assert.equal(logs[1].action, "docker-run-complete");
  } finally {
    await fs.rm(workspacePath, { recursive: true, force: true });
  }
});

test("docker runtime reports timeout outcome", async () => {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-runtime-"));
  const runtime = new Github_Flows_Execution_Runtime_Docker({
    childProcess: {
      execFile(_command, _args, _options, callback) {
        const error = new Error("timed out");
        // @ts-ignore
        error.code = "ETIMEDOUT";
        // @ts-ignore
        error.killed = true;
        callback(error, "", "timeout");
      },
    },
    fsPromises: fs,
  });

  try {
    const result = await runtime.run({
      launchContract: {
        agent: { command: ["echo"], args: ["hi"], prompt: "", type: "codex" },
        environment: { image: "codex-agent", workspacePath, setupScript: "", env: {}, timeoutSec: 5 },
      },
    });

    assert.deepEqual(result, {
      attempted: true,
      completed: false,
      exit: "timeout",
      stderr: "timeout",
      stdout: "",
    });
  } finally {
    await fs.rm(workspacePath, { recursive: true, force: true });
  }
});

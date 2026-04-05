import assert from "node:assert/strict";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import Github_Flows_Execution_Runtime_Docker from "../../../../src/Execution/Runtime/Docker.mjs";

test("docker runtime starts container from launch contract", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-runtime-"));
  const workspacePath = path.join(workspaceRoot, "ws", "octocat", "demo", "issues", "evt-1");
  await fs.mkdir(workspacePath, { recursive: true });
  const calls = [];
  const logs = [];
  const observedStdout = [];
  const observedStderr = [];
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = /** @type {typeof process.stdout.write} */ ((chunk, encoding, callback) => {
    observedStdout.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    if (typeof encoding === "function") encoding();
    if (typeof callback === "function") callback();
    return true;
  });
  process.stderr.write = /** @type {typeof process.stderr.write} */ ((chunk, encoding, callback) => {
    observedStderr.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    if (typeof encoding === "function") encoding();
    if (typeof callback === "function") callback();
    return true;
  });
  const runtime = new Github_Flows_Execution_Runtime_Docker({
    childProcess: {
      spawn(command, args, options) {
        calls.push({ command, args, options });
        const stdoutListeners = [];
        const stderrListeners = [];
        const closeListeners = [];
        const processMock = {
          killed: false,
          stdout: {
            on(event, listener) {
              if (event === "data") stdoutListeners.push(listener);
            },
          },
          stderr: {
            on(event, listener) {
              if (event === "data") stderrListeners.push(listener);
            },
          },
          on(event, listener) {
            if (event === "close") closeListeners.push(listener);
          },
          kill() {
            processMock.killed = true;
            return true;
          },
        };
        queueMicrotask(() => {
          stdoutListeners.forEach((listener) => listener(Buffer.from("ok")));
          stderrListeners.forEach((listener) => listener(Buffer.from("warn")));
          closeListeners.forEach((listener) => listener(0, null));
        });
        return processMock;
      },
    },
    fsModule: fsSync,
    fsPromises: fs,
    pathModule: path,
    logger: {
      logComponentAction(entry) {
        logs.push(entry);
      },
    },
  });

  try {
    const result = await runtime.run({
      launchContract: {
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
          workspaceRoot,
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
      stderr: "warn",
      stdout: "ok",
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, "docker");
    assert.deepEqual(calls[0].options, { stdio: ["ignore", "pipe", "pipe"] });
    assert.deepEqual(calls[0].args.slice(0, 11), [
      "run",
      "--rm",
      "--init",
      "--workdir",
      "/workspace",
      "--mount",
      `type=bind,src=${workspacePath},dst=/workspace`,
      "--mount",
      "type=bind,src=/home/codex/.codex,dst=/home/codex/.codex",
      "--env",
      "DEMO=1",
    ]);
    assert.equal(calls[0].args[11], "codex-agent");
    assert.equal(calls[0].args[12], "bash");
    assert.equal(calls[0].args[13], "-lc");
    assert.match(calls[0].args[14], /cd '\/workspace'/);
    assert.match(calls[0].args[14], /test -d repo/);
    assert.match(calls[0].args[14], /printf %s 'Solve the task\.'/);
    assert.equal(logs[0].action, "docker-run-start");
    assert.equal(logs[1].action, "docker-run-complete");
    assert.equal(await fs.readFile(path.join(workspaceRoot, "log", "run", "octocat", "demo", "issues", "evt-1", "stdout.log"), "utf8"), "ok");
    assert.equal(await fs.readFile(path.join(workspaceRoot, "log", "run", "octocat", "demo", "issues", "evt-1", "stderr.log"), "utf8"), "warn");
    assert.deepEqual(observedStdout, ["ok"]);
    assert.deepEqual(observedStderr, ["warn"]);
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("docker runtime reports timeout outcome", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-runtime-"));
  const workspacePath = path.join(workspaceRoot, "ws", "octocat", "demo", "issues", "evt-2");
  await fs.mkdir(workspacePath, { recursive: true });
  const runtime = new Github_Flows_Execution_Runtime_Docker({
    childProcess: {
      spawn() {
        const stdoutListeners = [];
        const stderrListeners = [];
        const closeListeners = [];
        const processMock = {
          killed: false,
          stdout: {
            on(event, listener) {
              if (event === "data") stdoutListeners.push(listener);
            },
          },
          stderr: {
            on(event, listener) {
              if (event === "data") stderrListeners.push(listener);
            },
          },
          on(event, listener) {
            if (event === "close") closeListeners.push(listener);
          },
          kill() {
            processMock.killed = true;
            queueMicrotask(() => {
              stderrListeners.forEach((listener) => listener(Buffer.from("timeout")));
              closeListeners.forEach((listener) => listener(null, "SIGKILL"));
            });
            return true;
          },
        };
        return processMock;
      },
    },
    fsModule: fsSync,
    fsPromises: fs,
    pathModule: path,
  });

  try {
    const result = await runtime.run({
      launchContract: {
        type: "docker",
        handler: { command: ["echo"], args: ["hi"], prompt: "", type: "codex" },
        environment: { dockerArgs: [], image: "codex-agent", workspaceRoot, workspacePath, setupScript: "", env: {}, timeoutSec: 1 },
      },
    });

    assert.deepEqual(result, {
      attempted: true,
      completed: false,
      exit: "timeout",
      stderr: "timeout",
      stdout: "",
    });
    assert.equal(await fs.readFile(path.join(workspaceRoot, "log", "run", "octocat", "demo", "issues", "evt-2", "stderr.log"), "utf8"), "timeout");
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

/**
 * Runs one resolved launch contract inside an isolated Docker container.
 */
const CONTAINER_WORKSPACE_PATH = "/workspace";
const EXECUTION_WORKSPACE_BRANCH = "ws";
const EXECUTION_LOG_BRANCH = "log/run";

function quoteShell(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`;
}

function validateLaunchContract(contract) {
  if (!contract || (typeof contract !== "object")) {
    throw new Error("Launch contract is required.");
  }

  const { agent, environment } = /** @type {{ agent?: unknown, environment?: unknown }} */ (contract);

  if (!agent || (typeof agent !== "object")) {
    throw new Error("Launch contract agent is required.");
  }
  if (!environment || (typeof environment !== "object")) {
    throw new Error("Launch contract environment is required.");
  }

  const typedAgent = /** @type {{ command?: unknown, args?: unknown, prompt?: unknown, type?: unknown }} */ (agent);
  const typedEnvironment = /** @type {{ env?: unknown, image?: unknown, setupScript?: unknown, timeoutSec?: unknown, workspacePath?: unknown, workspaceRoot?: unknown }} */ (environment);

  if ((typeof typedEnvironment.image !== "string") || typedEnvironment.image.length === 0) {
    throw new Error("Launch contract environment.image is required.");
  }
  if ((typeof typedEnvironment.workspaceRoot !== "string") || typedEnvironment.workspaceRoot.length === 0) {
    throw new Error("Launch contract environment.workspaceRoot is required.");
  }
  if ((typeof typedEnvironment.workspacePath !== "string") || typedEnvironment.workspacePath.length === 0) {
    throw new Error("Launch contract environment.workspacePath is required.");
  }
  if (!Array.isArray(typedAgent.command) || typedAgent.command.length === 0 || typedAgent.command.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error("Launch contract agent.command must be a non-empty string array.");
  }
  if ((typedAgent.args !== undefined) && (!Array.isArray(typedAgent.args) || typedAgent.args.some((item) => typeof item !== "string"))) {
    throw new Error("Launch contract agent.args must be a string array.");
  }
  if ((typeof typedEnvironment.timeoutSec !== "number") || !Number.isInteger(typedEnvironment.timeoutSec) || typedEnvironment.timeoutSec <= 0) {
    throw new Error("Launch contract environment.timeoutSec must be a positive integer.");
  }
  if ((typedEnvironment.setupScript !== undefined) && (typeof typedEnvironment.setupScript !== "string")) {
    throw new Error("Launch contract environment.setupScript must be a string.");
  }
  if ((typedEnvironment.env !== undefined) && ((typedEnvironment.env === null) || (typeof typedEnvironment.env !== "object") || Array.isArray(typedEnvironment.env))) {
    throw new Error("Launch contract environment.env must be an object.");
  }
  if ((typedAgent.prompt !== undefined) && (typeof typedAgent.prompt !== "string")) {
    throw new Error("Launch contract agent.prompt must be a string.");
  }
  if ((typedAgent.type !== undefined) && (typeof typedAgent.type !== "string")) {
    throw new Error("Launch contract agent.type must be a string.");
  }

  return {
    agent: {
      args: typedAgent.args ?? [],
      command: typedAgent.command,
      prompt: typedAgent.prompt ?? "",
      type: typedAgent.type ?? "agent",
    },
    environment: {
      env: /** @type {Record<string, string>} */ (typedEnvironment.env ?? {}),
      image: typedEnvironment.image,
      setupScript: typedEnvironment.setupScript ?? "",
      timeoutSec: typedEnvironment.timeoutSec,
      workspaceRoot: typedEnvironment.workspaceRoot,
      workspacePath: typedEnvironment.workspacePath,
    },
  };
}

function buildShellScript(contract) {
  const setupScript = contract.environment.setupScript.trim();
  const command = [...contract.agent.command, ...contract.agent.args].map(quoteShell).join(" ");
  const prompt = contract.agent.prompt.length > 0
    ? `printf %s ${quoteShell(contract.agent.prompt)} | ${command}`
    : command;
  return [
    "set -euo pipefail",
    `cd ${quoteShell(CONTAINER_WORKSPACE_PATH)}`,
    setupScript,
    prompt,
  ].filter((line) => line.length > 0).join("\n");
}

function buildDockerArgs(contract) {
  const args = [
    "run",
    "--rm",
    "--init",
    "--workdir",
    CONTAINER_WORKSPACE_PATH,
    "--mount",
    `type=bind,src=${contract.environment.workspacePath},dst=${CONTAINER_WORKSPACE_PATH}`,
  ];

  for (const [key, value] of Object.entries(contract.environment.env)) {
    args.push("--env", `${key}=${value}`);
  }

  args.push(
    contract.environment.image,
    "bash",
    "-lc",
    buildShellScript(contract),
  );

  return args;
}

function resolveLogPaths(pathModule, contract) {
  const workspaceRoot = pathModule.resolve(contract.environment.workspaceRoot);
  const workspacePath = pathModule.resolve(contract.environment.workspacePath);
  const executionRoot = pathModule.resolve(workspaceRoot, EXECUTION_WORKSPACE_BRANCH);
  const relativeWorkspacePath = pathModule.relative(executionRoot, workspacePath);

  if (
    relativeWorkspacePath.length === 0
    || relativeWorkspacePath.startsWith("..")
    || pathModule.isAbsolute(relativeWorkspacePath)
  ) {
    throw new Error("Launch contract environment.workspacePath must be located under workspaceRoot/ws.");
  }

  const logDirectory = pathModule.resolve(workspaceRoot, EXECUTION_LOG_BRANCH, relativeWorkspacePath);
  return {
    logDirectory,
    stderrPath: pathModule.join(logDirectory, "stderr.log"),
    stdoutPath: pathModule.join(logDirectory, "stdout.log"),
  };
}

async function closeStream(stream) {
  await new Promise((resolve, reject) => {
    stream.on("error", reject);
    stream.end(() => resolve(undefined));
  });
}

async function runDocker({ childProcess, contract, fsModule, fsPromises, pathModule }) {
  const dockerArgs = buildDockerArgs(contract);
  const logs = resolveLogPaths(pathModule, contract);
  await fsPromises.mkdir(logs.logDirectory, { recursive: true });

  return await new Promise((resolve, reject) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    const stdoutStream = fsModule.createWriteStream(logs.stdoutPath, { flags: "w" });
    const stderrStream = fsModule.createWriteStream(logs.stderrPath, { flags: "w" });
    let settled = false;
    let timeoutId;
    let killedByTimeout = false;

    const settleReject = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      reject(error);
    };

    const settleResolve = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(value);
    };

    const child = childProcess.spawn("docker", dockerArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const onStreamError = (error) => {
      if (!child.killed) child.kill("SIGKILL");
      settleReject(error);
    };

    stdoutStream.on("error", onStreamError);
    stderrStream.on("error", onStreamError);
    child.on("error", settleReject);

    timeoutId = setTimeout(() => {
      killedByTimeout = true;
      child.kill("SIGKILL");
    }, contract.environment.timeoutSec * 1000);

    child.stdout.on("data", (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      stdoutChunks.push(buffer);
      stdoutStream.write(buffer);
      process.stdout.write(buffer);
    });
    child.stderr.on("data", (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      stderrChunks.push(buffer);
      stderrStream.write(buffer);
      process.stderr.write(buffer);
    });

    child.on("close", async (code, signal) => {
      try {
        await Promise.all([closeStream(stdoutStream), closeStream(stderrStream)]);
      } catch (error) {
        settleReject(error);
        return;
      }

      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      if (killedByTimeout || signal === "SIGKILL") {
        const error = new Error("timed out");
        Object.assign(error, { code: "ETIMEDOUT", killed: true, signal, stderr, stdout });
        settleReject(error);
        return;
      }
      if (code !== 0) {
        const error = new Error(`docker exited with code ${code}`);
        Object.assign(error, { code, killed: false, signal, stderr, stdout });
        settleReject(error);
        return;
      }
      settleResolve({ stderr, stdout });
    });
  });
}

export default class Github_Flows_Execution_Runtime_Docker {
  /**
   * @param {object} deps
   * @param {{ spawn: typeof import("node:child_process").spawn }} deps.childProcess
   * @param {typeof import("node:fs")} deps.fsModule
   * @param {typeof import("node:fs/promises")} deps.fsPromises
   * @param {typeof import("node:path")} deps.pathModule
   * @param {{ logComponentAction?: (entry: {
   *   action: string,
   *   component: string,
   *   details?: unknown,
   *   message: string
   * }) => void }} [deps.logger]
   */
  constructor({ childProcess, fsModule, fsPromises, logger, pathModule }) {
    /**
     * @param {{ launchContract: Github_Flows_Execution_Launch_Contract }} params
     * @returns {Promise<{
     *   attempted: true,
     *   completed: boolean,
     *   exit: "success" | "failure" | "timeout",
     *   stderr: string,
     *   stdout: string
     * }>}
     */
    this.run = async function ({ launchContract }) {
      const contract = validateLaunchContract(launchContract);
      await fsPromises.stat(contract.environment.workspaceRoot);
      await fsPromises.stat(contract.environment.workspacePath);
      logger?.logComponentAction?.({
        component: "Github_Flows_Execution_Runtime_Docker",
        action: "docker-run-start",
        details: {
          image: contract.environment.image,
          timeoutSec: contract.environment.timeoutSec,
          workspaceRoot: contract.environment.workspaceRoot,
          workspacePath: contract.environment.workspacePath,
        },
        message: `Starting containerized execution for ${contract.agent.type}.`,
      });

      try {
        const result = await runDocker({ childProcess, contract, fsModule, fsPromises, pathModule });
        logger?.logComponentAction?.({
          component: "Github_Flows_Execution_Runtime_Docker",
          action: "docker-run-complete",
          details: {
            image: contract.environment.image,
            workspaceRoot: contract.environment.workspaceRoot,
            workspacePath: contract.environment.workspacePath,
          },
          message: `Completed containerized execution for ${contract.agent.type}.`,
        });
        return {
          attempted: true,
          completed: true,
          exit: "success",
          stderr: result.stderr,
          stdout: result.stdout,
        };
      } catch (error) {
        const typedError = /** @type {{ code?: string, stderr?: string, stdout?: string, killed?: boolean, signal?: string }} */ (error);
        const exit = typedError.code === "ETIMEDOUT" || typedError.killed || typedError.signal === "SIGKILL"
          ? "timeout"
          : "failure";
        logger?.logComponentAction?.({
          component: "Github_Flows_Execution_Runtime_Docker",
          action: exit === "timeout" ? "docker-run-timeout" : "docker-run-failed",
          details: {
            image: contract.environment.image,
            workspaceRoot: contract.environment.workspaceRoot,
            workspacePath: contract.environment.workspacePath,
          },
          message: exit === "timeout"
            ? `Timed out containerized execution for ${contract.agent.type}.`
            : `Failed containerized execution for ${contract.agent.type}.`,
        });
        return {
          attempted: true,
          completed: false,
          exit,
          stderr: typedError.stderr ?? "",
          stdout: typedError.stdout ?? "",
        };
      }
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({
    childProcess: "node:child_process",
    fsModule: "node:fs",
    fsPromises: "node:fs/promises",
    logger: "Github_Flows_Logger$",
    pathModule: "node:path",
  }),
});

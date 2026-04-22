// @ts-check
/**
 * @namespace Github_Flows_Execution_Runtime_Docker
 * @description Runs one resolved launch contract inside an isolated Docker container.
 */
const CONTAINER_WORKSPACE_PATH = "/workspace";
const SUPPORTED_HANDLER_TYPES = new Set(["agent", "shell"]);

function quoteShell(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`;
}

function validateLaunchContract(contract) {
  if (!contract || (typeof contract !== "object")) {
    throw new Error("Launch contract is required.");
  }

  const { environment, handler } = /** @type {{ environment?: unknown, handler?: unknown }} */ (contract);
  if (!handler || (typeof handler !== "object")) {
    throw new Error("Launch contract handler is required.");
  }
  if (!environment || (typeof environment !== "object")) {
    throw new Error("Launch contract environment is required.");
  }

  const typedHandler = /** @type {{ command?: unknown, args?: unknown, prompt?: unknown, type?: unknown }} */ (handler);
  const typedEnvironment = /** @type {{ dockerArgs?: unknown, env?: unknown, image?: unknown, setupScript?: unknown, timeoutSec?: unknown, workspacePath?: unknown, workspaceRoot?: unknown }} */ (environment);

  if ((typeof typedEnvironment.image !== "string") || typedEnvironment.image.length === 0) {
    throw new Error("Launch contract environment.image is required.");
  }
  if ((typeof typedEnvironment.workspaceRoot !== "string") || typedEnvironment.workspaceRoot.length === 0) {
    throw new Error("Launch contract environment.workspaceRoot is required.");
  }
  if ((typeof typedEnvironment.workspacePath !== "string") || typedEnvironment.workspacePath.length === 0) {
    throw new Error("Launch contract environment.workspacePath is required.");
  }
  if (typeof typedEnvironment.setupScript !== "string") {
    throw new Error("Launch contract environment.setupScript is required.");
  }
  if ((typedEnvironment.env === null) || (typeof typedEnvironment.env !== "object") || Array.isArray(typedEnvironment.env)) {
    throw new Error("Launch contract environment.env is required.");
  }
  if ((typedEnvironment.dockerArgs !== undefined) && (!Array.isArray(typedEnvironment.dockerArgs) || typedEnvironment.dockerArgs.some((item) => typeof item !== "string" || item.length === 0))) {
    throw new Error("Launch contract environment.dockerArgs must be a string array.");
  }
  if ((typeof typedEnvironment.timeoutSec !== "number") || !Number.isInteger(typedEnvironment.timeoutSec) || typedEnvironment.timeoutSec <= 0) {
    throw new Error("Launch contract environment.timeoutSec must be a positive integer.");
  }
  for (const [key, value] of Object.entries(/** @type {Record<string, unknown>} */ (typedEnvironment.env))) {
    if (typeof value !== "string") {
      throw new Error(`Launch contract environment.env.${key} must be a string.`);
    }
  }
  if ((typeof typedHandler.type !== "string") || typedHandler.type.length === 0) {
    throw new Error("Launch contract handler.type is required.");
  }
  if (!SUPPORTED_HANDLER_TYPES.has(typedHandler.type)) {
    throw new Error(`Launch contract handler.type is unsupported: ${typedHandler.type}`);
  }
  if (!Array.isArray(typedHandler.command) || typedHandler.command.length === 0 || typedHandler.command.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error("Launch contract handler.command must be a non-empty string array.");
  }
  if (!Array.isArray(typedHandler.args) || typedHandler.args.some((item) => typeof item !== "string")) {
    throw new Error("Launch contract handler.args must be a string array.");
  }
  if (typeof typedHandler.prompt !== "string") {
    throw new Error("Launch contract handler.prompt is required.");
  }

  return {
    handler: {
      args: typedHandler.args,
      command: typedHandler.command,
      prompt: typedHandler.prompt,
      type: typedHandler.type,
    },
    environment: {
      dockerArgs: typedEnvironment.dockerArgs ?? [],
      env: /** @type {Record<string, string>} */ (typedEnvironment.env),
      image: typedEnvironment.image,
      setupScript: typedEnvironment.setupScript,
      timeoutSec: typedEnvironment.timeoutSec,
      workspaceRoot: typedEnvironment.workspaceRoot,
      workspacePath: typedEnvironment.workspacePath,
    },
  };
}

function buildShellScript(contract) {
  const setupScript = contract.environment.setupScript.trim();
  const command = [...contract.handler.command, ...contract.handler.args].map(quoteShell).join(" ");
  const prompt = contract.handler.prompt.length > 0
    ? `printf %s ${quoteShell(contract.handler.prompt)} | ${command}`
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

  args.push(...contract.environment.dockerArgs);

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

function resolveLogPaths(pathModule, loggingContext) {
  const logDirectory = pathModule.resolve(loggingContext.logDirectory);
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

async function runDocker({ childProcess, contract, fsModule, fsPromises, loggingContext, pathModule }) {
  const dockerArgs = buildDockerArgs(contract);
  const logs = resolveLogPaths(pathModule, loggingContext);
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
   * @param {Github_Flows_Web_Handler_Webhook_EventLog} deps.eventLog
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
  constructor({ childProcess, eventLog, fsModule, fsPromises, logger, pathModule }) {
    /**
     * @param {{
     *   launchContract: Github_Flows_Execution_Launch_Contract,
     *   loggingContext: Github_Flows_Event_Logging_Context__Data,
     * }} params
     * @returns {Promise<Github_Flows_Execution_Runtime_Result>}
     */
    this.run = async function ({ launchContract, loggingContext }) {
      const contract = validateLaunchContract(launchContract);
      await fsPromises.stat(contract.environment.workspaceRoot);
      await fsPromises.stat(contract.environment.workspacePath);
      const emit = async function (action, message, details) {
        logger?.logComponentAction?.({
          component: "Github_Flows_Execution_Runtime_Docker",
          action,
          details,
          message,
        });
        await eventLog.logEventProcessing({
          action,
          component: "Github_Flows_Execution_Runtime_Docker",
          details,
          loggingContext,
          message,
          stage: "execution-runtime",
        });
      };
      logger?.logComponentAction?.({
        component: "Github_Flows_Execution_Runtime_Docker",
        action: "docker-run-start",
        details: {
          image: contract.environment.image,
          timeoutSec: contract.environment.timeoutSec,
          workspaceRoot: contract.environment.workspaceRoot,
          workspacePath: contract.environment.workspacePath,
        },
        message: `Starting containerized execution for ${contract.handler.type}.`,
      });
      await eventLog.logEventProcessing({
        action: "docker-run-start",
        component: "Github_Flows_Execution_Runtime_Docker",
        details: {
          image: contract.environment.image,
          timeoutSec: contract.environment.timeoutSec,
          workspaceRoot: contract.environment.workspaceRoot,
          workspacePath: contract.environment.workspacePath,
        },
        loggingContext,
        message: `Starting containerized execution for ${contract.handler.type}.`,
        stage: "runtime",
      });
      await emit("runtime-container-started", `Starting Docker runtime for ${loggingContext.eventId}.`, {
        eventId: loggingContext.eventId,
        exitCode: undefined,
        workspacePath: contract.environment.workspacePath,
      });

      try {
        const result = await runDocker({ childProcess, contract, fsModule, fsPromises, loggingContext, pathModule });
        logger?.logComponentAction?.({
          component: "Github_Flows_Execution_Runtime_Docker",
          action: "docker-run-complete",
          details: {
            image: contract.environment.image,
            workspaceRoot: contract.environment.workspaceRoot,
            workspacePath: contract.environment.workspacePath,
          },
          message: `Completed containerized execution for ${contract.handler.type}.`,
        });
        await eventLog.logEventProcessing({
          action: "docker-run-complete",
          component: "Github_Flows_Execution_Runtime_Docker",
          details: {
            image: contract.environment.image,
            workspaceRoot: contract.environment.workspaceRoot,
            workspacePath: contract.environment.workspacePath,
          },
          loggingContext,
          message: `Completed containerized execution for ${contract.handler.type}.`,
          stage: "runtime",
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
        await emit(
          exit === "timeout" ? "runtime-container-failed" : "runtime-container-failed",
          exit === "timeout"
            ? `Timed out Docker runtime for ${loggingContext.eventId}.`
            : `Failed Docker runtime for ${loggingContext.eventId}.`,
          {
            eventId: loggingContext.eventId,
            exitCode: typedError.code ?? null,
            workspacePath: contract.environment.workspacePath,
          },
        );
        logger?.logComponentAction?.({
          component: "Github_Flows_Execution_Runtime_Docker",
          action: exit === "timeout" ? "docker-run-timeout" : "docker-run-failed",
          details: {
            image: contract.environment.image,
            workspaceRoot: contract.environment.workspaceRoot,
            workspacePath: contract.environment.workspacePath,
          },
          message: exit === "timeout"
            ? `Timed out containerized execution for ${contract.handler.type}.`
            : `Failed containerized execution for ${contract.handler.type}.`,
        });
        await eventLog.logEventProcessing({
          action: exit === "timeout" ? "docker-run-timeout" : "docker-run-failed",
          component: "Github_Flows_Execution_Runtime_Docker",
          details: {
            image: contract.environment.image,
            workspaceRoot: contract.environment.workspaceRoot,
            workspacePath: contract.environment.workspacePath,
          },
          loggingContext,
          message: exit === "timeout"
            ? `Timed out containerized execution for ${contract.handler.type}.`
            : `Failed containerized execution for ${contract.handler.type}.`,
          stage: "runtime",
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
    eventLog: "Github_Flows_Web_Handler_Webhook_EventLog$",
    fsModule: "node:fs",
    fsPromises: "node:fs/promises",
    logger: "Github_Flows_Logger$",
    pathModule: "node:path",
  }),
});

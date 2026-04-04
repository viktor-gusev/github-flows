const CONTAINER_WORKSPACE_PATH = "/workspace";

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
  const typedEnvironment = /** @type {{ env?: unknown, image?: unknown, setupScript?: unknown, timeoutSec?: unknown, workspacePath?: unknown }} */ (environment);

  if ((typeof typedEnvironment.image !== "string") || typedEnvironment.image.length === 0) {
    throw new Error("Launch contract environment.image is required.");
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

async function runDocker(execFile, args, timeoutMs) {
  return await new Promise((resolve, reject) => {
    execFile("docker", args, { timeout: timeoutMs, killSignal: "SIGKILL" }, (error, stdout = "", stderr = "") => {
      if (error) {
        reject(Object.assign(error, { stderr, stdout }));
      } else {
        resolve({ stderr, stdout });
      }
    });
  });
}

export default class Github_Flows_Execution_Runtime_Docker {
  /**
   * @param {object} deps
   * @param {typeof import("node:child_process")} deps.childProcess
   * @param {typeof import("node:fs/promises")} deps.fsPromises
   * @param {{ logComponentAction?: (entry: {
   *   action: string,
   *   component: string,
   *   details?: unknown,
   *   message: string
   * }) => void }} [deps.logger]
   */
  constructor({ childProcess, fsPromises, logger }) {
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
      await fsPromises.stat(contract.environment.workspacePath);
      const dockerArgs = buildDockerArgs(contract);
      logger?.logComponentAction?.({
        component: "Github_Flows_Execution_Runtime_Docker",
        action: "docker-run-start",
        details: {
          image: contract.environment.image,
          timeoutSec: contract.environment.timeoutSec,
          workspacePath: contract.environment.workspacePath,
        },
        message: `Starting containerized execution for ${contract.agent.type}.`,
      });

      try {
        const result = await runDocker(childProcess.execFile.bind(childProcess), dockerArgs, contract.environment.timeoutSec * 1000);
        logger?.logComponentAction?.({
          component: "Github_Flows_Execution_Runtime_Docker",
          action: "docker-run-complete",
          details: {
            image: contract.environment.image,
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
    fsPromises: "node:fs/promises",
    logger: "Github_Flows_Logger$",
  }),
});

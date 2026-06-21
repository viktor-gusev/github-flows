// @ts-check
/**
 * @namespace Github_Flows_Execution_Start_Coordinator
 * @description Coordinates execution preparation, launch-contract creation, and runtime dispatch.
 */

function asRecord(value) {
  if (value && (typeof value === "object") && !Array.isArray(value)) {
    return /** @type {Record<string, unknown>} */ (value);
  }
  return {};
}

function requirePromptRefForAgent(selectedProfile) {
  const execution = asRecord(selectedProfile.execution);
  const handler = asRecord(execution.handler);
  if (handler.type !== "agent") return;
  if (typeof handler.promptRef === "string" && handler.promptRef.length > 0) return;
  throw new Error(`Agent execution requires execution.handler.promptRef: ${selectedProfile.id}`);
}

function getRemainingTimeoutSec(deadlineMs) {
  const remainingMs = deadlineMs - Date.now();
  if (remainingMs <= 0) {
    const error = new Error("timed out");
    Object.assign(error, { code: "ETIMEDOUT", killed: true, signal: "SIGKILL", stderr: "", stdout: "" });
    throw error;
  }
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

export default class Github_Flows_Execution_Start_Coordinator {
  /**
   * @param {object} deps
   * @param {{ spawn: typeof import("node:child_process").spawn }} deps.childProcess
   * @param {Github_Flows_Web_Handler_Webhook_EventLog} deps.eventLog
   * @param {Github_Flows_Execution_Launch_Contract_Factory} deps.executionLaunchContractFactory
   * @param {Github_Flows_Execution_Preparation_Prompt_Materializer} deps.executionPromptMaterializer
   * @param {Github_Flows_Execution_Runtime_Docker} deps.executionRuntimeDocker
   * @param {Github_Flows_Execution_Workspace_Preparer} deps.executionWorkspacePreparer
   * @param {{ logComponentAction?: (entry: {
   *   action: string,
   *   component: string,
   *   details?: unknown,
   *   message: string
   * }) => void }} [deps.logger]
   */
  constructor({ childProcess, eventLog, executionLaunchContractFactory, executionPromptMaterializer, executionRuntimeDocker, executionWorkspacePreparer, logger }) {
    const logStep = async function ({ action, details, loggingContext, message, stage }) {
      logger?.logComponentAction?.({
        component: "Github_Flows_Execution_Start_Coordinator",
        action,
        details,
        message,
      });
      await eventLog.logEventProcessing({
        action,
        component: "Github_Flows_Execution_Start_Coordinator",
        details,
        loggingContext,
        message,
        stage,
      });
    };

    const runHostScript = async function ({ launchContract, loggingContext, profileId, deadlineMs }) {
      const hostScript = launchContract.environment.hostScript;
      if (hostScript === undefined) {
        await logStep({
          action: "host-script-skipped",
          details: {
            eventId: loggingContext.eventId,
            profileId,
            reason: "absent",
            workspacePath: launchContract.environment.workspacePath,
          },
          loggingContext,
          message: `Skipped host script for profile ${profileId}.`,
          stage: "execution-preparation",
        });
        return;
      }
      if (hostScript.length === 0) {
        await logStep({
          action: "host-script-skipped",
          details: {
            eventId: loggingContext.eventId,
            profileId,
            reason: "noop",
            workspacePath: launchContract.environment.workspacePath,
          },
          loggingContext,
          message: `Skipped empty host script for profile ${profileId}.`,
          stage: "execution-preparation",
        });
        return;
      }

      const startedAtMs = Date.now();
      await logStep({
        action: "host-script-started",
        details: {
          command: hostScript,
          eventId: loggingContext.eventId,
          profileId,
          workspacePath: launchContract.environment.workspacePath,
        },
        loggingContext,
        message: `Starting host script for profile ${profileId}.`,
        stage: "execution-preparation",
      });

      const remainingTimeoutSec = getRemainingTimeoutSec(deadlineMs);
      const env = { ...process.env, ...launchContract.environment.env };

      await new Promise((resolve, reject) => {
        const child = childProcess.spawn("bash", ["-lc", hostScript], {
          cwd: launchContract.environment.workspacePath,
          env,
          stdio: ["ignore", "pipe", "pipe"],
        });
        const stdoutChunks = [];
        const stderrChunks = [];
        let settled = false;
        let timeoutId;
        let killedByTimeout = false;

        const settleReject = (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          reject(error);
        };
        const settleResolve = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          resolve(undefined);
        };

        child.on("error", settleReject);
        timeoutId = setTimeout(() => {
          killedByTimeout = true;
          child.kill("SIGKILL");
        }, remainingTimeoutSec * 1000);

        child.stdout.on("data", (chunk) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          stdoutChunks.push(buffer);
          process.stdout.write(buffer);
        });
        child.stderr.on("data", (chunk) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          stderrChunks.push(buffer);
          process.stderr.write(buffer);
        });

        child.on("close", (code, signal) => {
          const stdout = Buffer.concat(stdoutChunks).toString("utf8");
          const stderr = Buffer.concat(stderrChunks).toString("utf8");
          if (killedByTimeout || signal === "SIGKILL") {
            const error = new Error("timed out");
            Object.assign(error, { code: "ETIMEDOUT", killed: true, signal, stderr, stdout });
            settleReject(error);
            return;
          }
          if (code !== 0) {
            const error = new Error(`host script exited with code ${code}`);
            Object.assign(error, { code, killed: false, signal, stderr, stdout });
            settleReject(error);
            return;
          }
          settleResolve();
        });
      });

      await logStep({
        action: "host-script-completed",
        details: {
          command: hostScript,
          durationMs: Date.now() - startedAtMs,
          eventId: loggingContext.eventId,
          profileId,
          workspacePath: launchContract.environment.workspacePath,
        },
        loggingContext,
        message: `Completed host script for profile ${profileId}.`,
        stage: "execution-preparation",
      });
    };

    /**
     * @param {{
     *   event: unknown,
     *   hostAttributes?: Github_Flows_Event_Attribute__Set,
     *   loggingContext: Github_Flows_Event_Logging_Context__Data,
     *   selectedProfile: Github_Flows_Execution_Profile__Selected
     * }} params
     */
    this.start = async function ({ event, hostAttributes = {}, loggingContext, selectedProfile }) {
      requirePromptRefForAgent(selectedProfile);

      await logStep({
        action: "execution-start-requested",
        details: {
          selectedProfile: {
            id: selectedProfile.id,
            orderKey: selectedProfile.orderKey,
            trigger: selectedProfile.trigger,
          },
        },
        loggingContext,
        message: `Execution requested for profile ${selectedProfile.id}.`,
        stage: "execution-decision",
      });

      let workspace;
      try {
        await logStep({
          action: "workspace-prepare-requested",
          details: {
            eventId: loggingContext.eventId,
            profileId: selectedProfile.id,
            repository: `${loggingContext.owner}/${loggingContext.repo}`,
          },
          loggingContext,
          message: `Preparing execution workspace for profile ${selectedProfile.id}.`,
          stage: "execution-preparation",
        });
        workspace = await executionWorkspacePreparer.prepareByGithubEvent({ event, loggingContext });
        await logStep({
          action: "workspace-prepared",
          details: {
            eventId: loggingContext.eventId,
            profileId: selectedProfile.id,
            repository: `${loggingContext.owner}/${loggingContext.repo}`,
            workspacePath: workspace.workspacePath,
          },
          loggingContext,
          message: `Prepared execution workspace for profile ${selectedProfile.id}.`,
          stage: "execution-preparation",
        });
      } catch (error) {
        await logStep({
          action: "workspace-prepare-failed",
          details: {
            eventId: loggingContext.eventId,
            profileId: selectedProfile.id,
            repository: `${loggingContext.owner}/${loggingContext.repo}`,
            error: error instanceof Error ? error.message : String(error),
          },
          loggingContext,
          message: `Failed to prepare execution workspace for profile ${selectedProfile.id}.`,
          stage: "execution-preparation",
        });
        throw error;
      }

      const preparedPrompt = await executionPromptMaterializer.materialize({
        event,
        hostAttributes,
        loggingContext,
        selectedProfile,
        workspace,
      });
      const launchContract = executionLaunchContractFactory.create({
        loggingContext,
        prompt: preparedPrompt.prompt,
        selectedProfile,
        workspace,
      });

      await logStep({
        action: "launch-contract-materialized",
        details: {
          handlerType: launchContract.handler.type,
          image: launchContract.environment.image,
          profileId: selectedProfile.id,
          workspaceRoot: launchContract.environment.workspaceRoot,
          workspacePath: launchContract.environment.workspacePath,
        },
        loggingContext,
        message: `Materialized launch contract for profile ${selectedProfile.id}.`,
        stage: "execution-preparation",
      });

      const deadlineMs = Date.now() + (launchContract.environment.timeoutSec * 1000);
      try {
        await runHostScript({
          deadlineMs,
          launchContract,
          loggingContext,
          profileId: selectedProfile.id,
        });
      } catch (error) {
        const typedError = /** @type {{ code?: string|number, stderr?: string, stdout?: string, killed?: boolean, signal?: string }} */ (error);
        await logStep({
          action: "host-script-failed",
          details: {
            command: launchContract.environment.hostScript ?? "",
            error: error instanceof Error ? error.message : String(error),
            eventId: loggingContext.eventId,
            exitCode: typedError.code ?? null,
            profileId: selectedProfile.id,
            workspacePath: launchContract.environment.workspacePath,
          },
          loggingContext,
          message: `Failed host script for profile ${selectedProfile.id}.`,
          stage: "execution-preparation",
        });
        throw error;
      }

      const runtimeLaunchContract = {
        ...launchContract,
        environment: {
          ...launchContract.environment,
          timeoutSec: getRemainingTimeoutSec(deadlineMs),
        },
      };

      await logStep({
        action: "runtime-start-requested",
        details: {
          eventId: loggingContext.eventId,
          profileId: selectedProfile.id,
          repository: `${loggingContext.owner}/${loggingContext.repo}`,
          timeoutSec: runtimeLaunchContract.environment.timeoutSec,
          workspacePath: runtimeLaunchContract.environment.workspacePath,
        },
        loggingContext,
        message: `Starting runtime for profile ${selectedProfile.id}.`,
        stage: "execution-runtime",
      });
      const result = await executionRuntimeDocker.run({ launchContract: runtimeLaunchContract, loggingContext });
      await logStep({
        action: "runtime-completed",
        details: {
          eventId: loggingContext.eventId,
          exit: result.exit,
          profileId: selectedProfile.id,
          repository: `${loggingContext.owner}/${loggingContext.repo}`,
          workspacePath: runtimeLaunchContract.environment.workspacePath,
        },
        loggingContext,
        message: `Completed runtime for profile ${selectedProfile.id}.`,
        stage: "execution-runtime",
      });
      return result;
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({
    childProcess: "node:child_process",
    eventLog: "Github_Flows_Web_Handler_Webhook_EventLog$",
    executionLaunchContractFactory: "Github_Flows_Execution_Launch_Contract_Factory$",
    executionPromptMaterializer: "Github_Flows_Execution_Preparation_Prompt_Materializer$",
    executionRuntimeDocker: "Github_Flows_Execution_Runtime_Docker$",
    executionWorkspacePreparer: "Github_Flows_Execution_Workspace_Preparer$",
    logger: "Github_Flows_Logger$",
  }),
});

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

export default class Github_Flows_Execution_Start_Coordinator {
  /**
   * @param {object} deps
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
  constructor({ eventLog, executionLaunchContractFactory, executionPromptMaterializer, executionRuntimeDocker, executionWorkspacePreparer, logger }) {
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

    /**
     * @param {{
     *   event: unknown,
     *   loggingContext: Github_Flows_Event_Logging_Context__Data,
     *   selectedProfile: Github_Flows_Execution_Profile__Selected
     * }} params
     */
    this.start = async function ({ event, loggingContext, selectedProfile }) {
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

      const preparedPrompt = await executionPromptMaterializer.materialize({ event, loggingContext, selectedProfile, workspace });
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

      await logStep({
        action: "runtime-start-requested",
        details: {
          eventId: loggingContext.eventId,
          profileId: selectedProfile.id,
          repository: `${loggingContext.owner}/${loggingContext.repo}`,
          workspacePath: launchContract.environment.workspacePath,
        },
        loggingContext,
        message: `Starting runtime for profile ${selectedProfile.id}.`,
        stage: "execution-runtime",
      });
      const result = await executionRuntimeDocker.run({ launchContract, loggingContext });
      await logStep({
        action: "runtime-completed",
        details: {
          eventId: loggingContext.eventId,
          exit: result.exit,
          profileId: selectedProfile.id,
          repository: `${loggingContext.owner}/${loggingContext.repo}`,
          workspacePath: launchContract.environment.workspacePath,
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
    eventLog: "Github_Flows_Web_Handler_Webhook_EventLog$",
    executionLaunchContractFactory: "Github_Flows_Execution_Launch_Contract_Factory$",
    executionPromptMaterializer: "Github_Flows_Execution_Preparation_Prompt_Materializer$",
    executionRuntimeDocker: "Github_Flows_Execution_Runtime_Docker$",
    executionWorkspacePreparer: "Github_Flows_Execution_Workspace_Preparer$",
    logger: "Github_Flows_Logger$",
  }),
});

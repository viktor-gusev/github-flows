/**
 * Coordinates execution preparation, launch-contract creation, and runtime dispatch.
 */
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
    /**
     * @param {{
     *   event: unknown,
     *   loggingContext: Github_Flows_Event_Logging_Context__Data,
     *   selectedProfile: Github_Flows_Execution_Profile__Selected
     * }} params
     */
    this.start = async function ({ event, loggingContext, selectedProfile }) {
      logger?.logComponentAction?.({
        component: "Github_Flows_Execution_Start_Coordinator",
        action: "execution-start-decision",
        details: {
          selectedProfile: {
            id: selectedProfile.id,
            orderKey: selectedProfile.orderKey,
            trigger: selectedProfile.trigger,
          },
        },
        message: `Starting execution for profile ${selectedProfile.id}.`,
      });
      await eventLog.logEventProcessing({
        action: "execution-start-decision",
        component: "Github_Flows_Execution_Start_Coordinator",
        details: {
          selectedProfile: {
            id: selectedProfile.id,
            orderKey: selectedProfile.orderKey,
            trigger: selectedProfile.trigger,
          },
        },
        loggingContext,
        message: `Starting execution for profile ${selectedProfile.id}.`,
        stage: "execution-decision",
      });

      const workspace = await executionWorkspacePreparer.prepareByGithubEvent({ event, loggingContext });
      const prompt = await executionPromptMaterializer.materialize({ event, loggingContext, selectedProfile, workspace });
      const launchContract = executionLaunchContractFactory.create({ loggingContext, prompt, selectedProfile, workspace });

      logger?.logComponentAction?.({
        component: "Github_Flows_Execution_Start_Coordinator",
        action: "launch-contract-materialized",
        details: {
          image: launchContract.environment.image,
          profileId: selectedProfile.id,
          workspaceRoot: launchContract.environment.workspaceRoot,
          workspacePath: launchContract.environment.workspacePath,
        },
        message: `Materialized launch contract for profile ${selectedProfile.id}.`,
      });
      await eventLog.logEventProcessing({
        action: "launch-contract-materialized",
        component: "Github_Flows_Execution_Start_Coordinator",
        details: {
          image: launchContract.environment.image,
          profileId: selectedProfile.id,
          workspaceRoot: launchContract.environment.workspaceRoot,
          workspacePath: launchContract.environment.workspacePath,
        },
        loggingContext,
        message: `Materialized launch contract for profile ${selectedProfile.id}.`,
        stage: "execution-preparation",
      });

      if (launchContract.type !== "docker") {
        throw new Error(`Unsupported launch contract type: ${launchContract.type}`);
      }
      return await executionRuntimeDocker.run({ launchContract, loggingContext });
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

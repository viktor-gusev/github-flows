/**
 * Coordinates execution preparation, launch-contract creation, and runtime dispatch.
 */
export default class Github_Flows_Execution_Start_Coordinator {
  /**
   * @param {object} deps
   * @param {Github_Flows_Execution_Launch_Contract_Factory} deps.executionLaunchContractFactory
   * @param {Github_Flows_Execution_Runtime_Docker} deps.executionRuntimeDocker
   * @param {Github_Flows_Execution_Workspace_Preparer} deps.executionWorkspacePreparer
   * @param {{ logComponentAction?: (entry: {
   *   action: string,
   *   component: string,
   *   details?: unknown,
   *   message: string
   * }) => void }} [deps.logger]
   */
  constructor({ executionLaunchContractFactory, executionRuntimeDocker, executionWorkspacePreparer, logger }) {
    /**
     * @param {{
     *   event: unknown,
     *   selectedProfile: Github_Flows_Execution_Profile__Selected
     * }} params
     */
    this.start = async function ({ event, selectedProfile }) {
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

      const workspace = await executionWorkspacePreparer.prepareByGithubEvent({ event });
      const launchContract = executionLaunchContractFactory.create({ selectedProfile, workspace });

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

      if (launchContract.type !== "docker") {
        throw new Error(`Unsupported launch contract type: ${launchContract.type}`);
      }
      return await executionRuntimeDocker.run({ launchContract });
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({
    executionLaunchContractFactory: "Github_Flows_Execution_Launch_Contract_Factory$",
    executionRuntimeDocker: "Github_Flows_Execution_Runtime_Docker$",
    executionWorkspacePreparer: "Github_Flows_Execution_Workspace_Preparer$",
    logger: "Github_Flows_Logger$",
  }),
});

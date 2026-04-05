/**
 * Coordinates one permitted execution from selected profile to Docker runtime.
 */
function asRecord(value) {
  if (value && (typeof value === "object") && !Array.isArray(value)) {
    return /** @type {Record<string, unknown>} */ (value);
  }
  return {};
}

function asStringArray(value, fallback = []) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : fallback;
}

function requireString(value, field) {
  if ((typeof value !== "string") || value.length === 0) {
    throw new Error(`Missing required launch field: ${field}`);
  }
  return value;
}

export default class Github_Flows_Execution_Start_Coordinator {
  /**
   * @param {object} deps
   * @param {Github_Flows_Execution_Runtime_Docker} deps.executionRuntimeDocker
   * @param {Github_Flows_Execution_Workspace_Preparer} deps.executionWorkspacePreparer
   * @param {{ logComponentAction?: (entry: {
   *   action: string,
   *   component: string,
   *   details?: unknown,
   *   message: string
   * }) => void }} [deps.logger]
   */
  constructor({ executionRuntimeDocker, executionWorkspacePreparer, logger }) {
    const materializeLaunchContract = function ({ selectedProfile, workspace }) {
      const launch = asRecord(selectedProfile.launch);
      const agent = asRecord(launch.agent);
      const runtime = asRecord(launch.runtime);

      return {
        agent: {
          type: requireString(agent.type, "launch.agent.type"),
          command: asStringArray(agent.command, ["tee"]),
          args: asStringArray(agent.args, ["/tmp/github-flows-prompt.txt"]),
          prompt: typeof launch.prompt === "string" ? launch.prompt : "",
        },
        environment: {
          image: requireString(runtime.image, "launch.runtime.image"),
          workspaceRoot: workspace.workspaceRoot,
          workspacePath: workspace.workspacePath,
          setupScript: typeof runtime.setupScript === "string" ? runtime.setupScript : "test -d repo",
          env: /** @type {Record<string, string>} */ (Object.fromEntries(
            Object.entries(asRecord(runtime.env))
              .filter(([, value]) => typeof value === "string"),
          )),
          timeoutSec: Number.isInteger(runtime.timeoutSec) && runtime.timeoutSec > 0 ? runtime.timeoutSec : 1800,
        },
      };
    };

    /**
     * @param {{
     *   event: unknown,
     *   selectedProfile: {
     *     id: string,
     *     launch: Record<string, unknown>,
     *     orderKey: string,
     *     trigger: Record<string, unknown>
     *   }
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
      const launchContract = materializeLaunchContract({ selectedProfile, workspace });

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

      return await executionRuntimeDocker.run({ launchContract });
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({
    executionRuntimeDocker: "Github_Flows_Execution_Runtime_Docker$",
    executionWorkspacePreparer: "Github_Flows_Execution_Workspace_Preparer$",
    logger: "Github_Flows_Logger$",
  }),
});

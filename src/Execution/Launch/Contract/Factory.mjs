/**
 * Builds fully resolved launch contracts from explicit execution profile and workspace inputs.
 */
function asRecord(value) {
  if (value && (typeof value === "object") && !Array.isArray(value)) {
    return /** @type {Record<string, unknown>} */ (value);
  }
  return {};
}

function requireString(value, field) {
  if ((typeof value !== "string") || value.length === 0) {
    throw new Error(`Missing required launch field: ${field}`);
  }
  return value;
}

function requireStringArray(value, field) {
  if (!Array.isArray(value) || value.some((item) => (typeof item !== "string") || item.length === 0)) {
    throw new Error(`Missing required launch field: ${field}`);
  }
  return value;
}

function requirePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Missing required launch field: ${field}`);
  }
  return value;
}

function requireStringRecord(value, field) {
  const record = asRecord(value);
  for (const [key, item] of Object.entries(record)) {
    if (typeof item !== "string") {
      throw new Error(`Missing required launch field: ${field}.${key}`);
    }
  }
  return /** @type {Record<string, string>} */ (record);
}

export default class Github_Flows_Execution_Launch_Contract_Factory {
  /**
   * @param {object} deps
   * @param {{ logComponentAction?: (entry: {
   *   action: string,
   *   component: string,
   *   details?: unknown,
   *   message: string
   * }) => void }} [deps.logger]
   */
  constructor({ logger }) {
    /**
     * @param {{
     *   selectedProfile: Github_Flows_Execution_Profile__Selected,
     *   workspace: Github_Flows_Execution_Workspace
     * }} params
     * @returns {Github_Flows_Execution_Launch_Contract}
     */
    this.create = function ({ selectedProfile, workspace }) {
      const launch = asRecord(selectedProfile.launch);
      const handler = asRecord(launch.handler);
      const runtime = asRecord(launch.runtime);

      const contract = {
        type: requireString(selectedProfile.type, "profile.type"),
        handler: {
          type: requireString(handler.type, "launch.handler.type"),
          command: requireStringArray(handler.command, "launch.handler.command"),
          args: requireStringArray(handler.args, "launch.handler.args"),
          prompt: requireString(launch.prompt, "launch.prompt"),
        },
        environment: {
          image: requireString(runtime.image, "launch.runtime.image"),
          workspaceRoot: requireString(workspace.workspaceRoot, "workspace.workspaceRoot"),
          workspacePath: requireString(workspace.workspacePath, "workspace.workspacePath"),
          setupScript: requireString(runtime.setupScript, "launch.runtime.setupScript"),
          env: requireStringRecord(runtime.env, "launch.runtime.env"),
          timeoutSec: requirePositiveInteger(runtime.timeoutSec, "launch.runtime.timeoutSec"),
        },
      };

      logger?.logComponentAction?.({
        component: "Github_Flows_Execution_Launch_Contract_Factory",
        action: "launch-contract-create",
        details: {
          profileId: selectedProfile.id,
          type: contract.type,
          workspacePath: contract.environment.workspacePath,
        },
        message: `Created launch contract for profile ${selectedProfile.id}.`,
      });

      return contract;
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({
    logger: "Github_Flows_Logger$",
  }),
});

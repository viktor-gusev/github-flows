// @ts-check
/**
 * @namespace Github_Flows_Execution_Launch_Contract_Factory
 * @description Builds fully resolved launch contracts from explicit execution profile and workspace inputs.
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

function optionalStringArray(value, field) {
  if (value === undefined) {
    return [];
  }
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

function requireHandlerType(value, field) {
  if ((value !== "agent") && (value !== "shell")) {
    throw new Error(`Missing required launch field: ${field}`);
  }
  return value;
}

export default class Github_Flows_Execution_Launch_Contract_Factory {
  /**
   * @param {object} deps
   * @param {Github_Flows_Web_Handler_Webhook_EventLog} deps.eventLog
   * @param {{
   *   logComponentAction?: (entry: {
   *     action: string,
   *     component: string,
   *     details?: unknown,
   *     message: string
   *   }) => void,
   *   logEventProcessing?: (entry: {
   *     action: string,
   *     component: string,
   *     details?: unknown,
   *     loggingContext?: Github_Flows_Event_Logging_Context__Data,
   *     message: string,
   *     stage?: string,
   *   }) => Promise<void>,
   * }} [deps.logger]
   */
  constructor({ eventLog, logger }) {
    /**
     * @param {{
     *   loggingContext?: Github_Flows_Event_Logging_Context__Data,
     *   prompt: string,
     *   selectedProfile: Github_Flows_Execution_Profile__Selected,
     *   workspace: Github_Flows_Execution_Workspace
     * }} params
     * @returns {Github_Flows_Execution_Launch_Contract}
     */
    this.create = function ({ loggingContext, prompt, selectedProfile, workspace }) {
      const execution = asRecord(selectedProfile.execution);
      const handler = asRecord(execution.handler);
      const runtime = asRecord(execution.runtime);

      const contract = {
        handler: {
          type: requireHandlerType(handler.type, "execution.handler.type"),
          command: requireStringArray(handler.command, "execution.handler.command"),
          args: requireStringArray(handler.args, "execution.handler.args"),
          prompt: requireString(prompt, "prepared.prompt"),
        },
        environment: {
          dockerArgs: optionalStringArray(runtime.dockerArgs, "execution.runtime.dockerArgs"),
          image: requireString(runtime.image, "execution.runtime.image"),
          workspaceRoot: requireString(workspace.workspaceRoot, "workspace.workspaceRoot"),
          workspacePath: requireString(workspace.workspacePath, "workspace.workspacePath"),
          setupScript: requireString(runtime.setupScript, "execution.runtime.setupScript"),
          env: requireStringRecord(runtime.env, "execution.runtime.env"),
          timeoutSec: requirePositiveInteger(runtime.timeoutSec, "execution.runtime.timeoutSec"),
        },
      };

      logger?.logComponentAction?.({
        component: "Github_Flows_Execution_Launch_Contract_Factory",
        action: "launch-contract-create",
        details: {
          handlerType: contract.handler.type,
          profileId: selectedProfile.id,
          workspacePath: contract.environment.workspacePath,
        },
        message: `Created launch contract for profile ${selectedProfile.id}.`,
      });
      void eventLog?.logEventProcessing?.({
        action: "launch-contract-create",
        component: "Github_Flows_Execution_Launch_Contract_Factory",
        details: {
          handlerType: contract.handler.type,
          profileId: selectedProfile.id,
          workspacePath: contract.environment.workspacePath,
        },
        loggingContext,
        message: `Created launch contract for profile ${selectedProfile.id}.`,
        stage: "execution-preparation",
      });

      return contract;
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({
    eventLog: "Github_Flows_Web_Handler_Webhook_EventLog$",
    logger: "Github_Flows_Logger$",
  }),
});

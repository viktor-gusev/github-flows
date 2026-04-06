/**
 * Materializes prompt templates into resolved prompt text during execution preparation.
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

function resolvePathValue(source, pathExpression) {
  const segments = pathExpression.split(".").filter((segment) => segment.length > 0);
  let current = source;
  for (const segment of segments) {
    if ((current === null) || (typeof current !== "object") || Array.isArray(current)) {
      return undefined;
    }
    current = /** @type {Record<string, unknown>} */ (current)[segment];
  }
  return current;
}

function materializePlaceholders(template, context) {
  return template.replaceAll(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g, (_match, expression) => {
    const value = resolvePathValue(context, expression);
    if (
      value === undefined
      || value === null
      || (typeof value === "object")
    ) {
      throw new Error(`Unable to resolve prompt placeholder: ${expression}`);
    }
    return String(value);
  });
}

export default class Github_Flows_Execution_Preparation_Prompt_Materializer {
  /**
   * @param {object} deps
   * @param {Github_Flows_Web_Handler_Webhook_EventLog} deps.eventLog
   * @param {typeof import("node:fs/promises")} deps.fsPromises
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
   * @param {typeof import("node:path")} deps.pathModule
   * @param {Github_Flows_Config_Runtime} deps.runtime
   */
  constructor({ eventLog, fsPromises, logger, pathModule, runtime }) {
    /**
     * @param {{
     *   event: unknown,
     *   loggingContext?: Github_Flows_Event_Logging_Context__Data,
     *   selectedProfile: Github_Flows_Execution_Profile__Selected,
     *   workspace: Github_Flows_Execution_Workspace
     * }} params
     * @returns {Promise<string>}
     */
    this.materialize = async function ({ event, loggingContext, selectedProfile, workspace }) {
      const execution = asRecord(selectedProfile.execution);
      const handler = asRecord(execution.handler);
      const promptRef = requireString(handler.promptRef, "execution.handler.promptRef");
      const promptRefBaseDir = requireString(selectedProfile.promptRefBaseDir, "profile.promptRefBaseDir");
      const cfgRoot = pathModule.resolve(runtime.workspaceRoot, "cfg");
      const templatePath = pathModule.resolve(cfgRoot, promptRefBaseDir, promptRef);
      const relativeTemplatePath = pathModule.relative(cfgRoot, templatePath);

      if (
        relativeTemplatePath.length === 0
        || relativeTemplatePath.startsWith("..")
        || pathModule.isAbsolute(relativeTemplatePath)
      ) {
        throw new Error(`Prompt template path must stay under cfg/: ${promptRef}`);
      }

      const template = await fsPromises.readFile(templatePath, "utf8");
      const prompt = materializePlaceholders(template, {
        event: asRecord(event),
        eventId: workspace.eventId,
        eventType: workspace.eventType,
        githubRepoId: workspace.githubRepoId,
        owner: workspace.owner,
        repo: workspace.repo,
        repoPath: workspace.repoPath,
        repositoryCachePath: workspace.repositoryCachePath,
        workspacePath: workspace.workspacePath,
        workspaceRoot: workspace.workspaceRoot,
      });

      logger?.logComponentAction?.({
        component: "Github_Flows_Execution_Preparation_Prompt_Materializer",
        action: "prompt-materialize",
        details: {
          profileId: selectedProfile.id,
          promptRef,
          templatePath,
        },
        message: `Materialized prompt template for profile ${selectedProfile.id}.`,
      });
      await eventLog?.logEventProcessing?.({
        action: "prompt-materialize",
        component: "Github_Flows_Execution_Preparation_Prompt_Materializer",
        details: {
          profileId: selectedProfile.id,
          promptRef,
          templatePath,
        },
        loggingContext,
        message: `Materialized prompt template for profile ${selectedProfile.id}.`,
        stage: "execution-preparation",
      });

      return prompt;
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({
    eventLog: "Github_Flows_Web_Handler_Webhook_EventLog$",
    fsPromises: "node:fs/promises",
    logger: "Github_Flows_Logger$",
    pathModule: "node:path",
    runtime: "Github_Flows_Config_Runtime$",
  }),
});

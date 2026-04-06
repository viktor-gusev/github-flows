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

function isScalarValue(value) {
  return ["string", "number", "boolean"].includes(typeof value);
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

function buildWorkspaceValueMap(workspace) {
  return {
    eventId: workspace.eventId,
    eventType: workspace.eventType,
    githubRepoId: workspace.githubRepoId,
    owner: workspace.owner,
    repo: workspace.repo,
    repoPath: workspace.repoPath,
    repositoryCachePath: workspace.repositoryCachePath,
    workspacePath: workspace.workspacePath,
    workspaceRoot: workspace.workspaceRoot,
  };
}

function resolvePromptBindings({ event, selectedProfile, workspace }) {
  const handler = asRecord(asRecord(selectedProfile.execution).handler);
  const configuredBindings = asRecord(handler.promptVariables);
  const sources = {
    event: asRecord(event),
    workspace: buildWorkspaceValueMap(workspace),
  };
  const resolved = {};

  for (const [variableName, sourcePath] of Object.entries(configuredBindings)) {
    if ((typeof variableName !== "string") || variableName.length === 0) {
      throw new Error("Prompt variable name must be a non-empty string.");
    }
    if ((typeof sourcePath !== "string") || sourcePath.length === 0) {
      throw new Error(`Prompt binding source path must be a non-empty string: ${variableName}`);
    }
    const [root] = sourcePath.split(".", 1);
    if ((root !== "event") && (root !== "workspace")) {
      throw new Error(`Unsupported prompt binding source path: ${sourcePath}`);
    }
    const value = resolvePathValue(sources, sourcePath);
    if (!isScalarValue(value)) {
      throw new Error(`Unable to resolve prompt binding to exactly one value: ${variableName} <- ${sourcePath}`);
    }
    resolved[variableName] = value;
  }

  return /** @type {Record<string, string | number | boolean>} */ (resolved);
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
     * @returns {Promise<Github_Flows_Execution_Preparation_Prompt_Materializer__Result>}
     */
    this.materialize = async function ({ event, loggingContext, selectedProfile, workspace }) {
      const execution = asRecord(selectedProfile.execution);
      const handler = asRecord(execution.handler);
      const promptRef = requireString(handler.promptRef, "execution.handler.promptRef");
      const promptRefBaseDir = requireString(selectedProfile.promptRefBaseDir, "profile.promptRefBaseDir");
      const cfgRoot = pathModule.resolve(runtime.workspaceRoot, "cfg");
      const templatePath = pathModule.resolve(cfgRoot, promptRefBaseDir, promptRef);
      const relativeTemplatePath = pathModule.relative(cfgRoot, templatePath);
      const promptBindings = resolvePromptBindings({ event, selectedProfile, workspace });

      if (
        relativeTemplatePath.length === 0
        || relativeTemplatePath.startsWith("..")
        || pathModule.isAbsolute(relativeTemplatePath)
      ) {
        throw new Error(`Prompt template path must stay under cfg/: ${promptRef}`);
      }

      const template = await fsPromises.readFile(templatePath, "utf8");
      const prompt = materializePlaceholders(template, {
        ...buildWorkspaceValueMap(workspace),
        ...promptBindings,
      });

      if (loggingContext && Object.keys(promptBindings).length > 0) {
        await eventLog?.persistPromptBindings?.({
          bindings: promptBindings,
          loggingContext,
        });
      }

      logger?.logComponentAction?.({
        component: "Github_Flows_Execution_Preparation_Prompt_Materializer",
        action: "prompt-materialize",
        details: {
          promptBindings,
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
          promptBindings,
          profileId: selectedProfile.id,
          promptRef,
          templatePath,
        },
        loggingContext,
        message: `Materialized prompt template for profile ${selectedProfile.id}.`,
        stage: "execution-preparation",
      });

      return { prompt, promptBindings };
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

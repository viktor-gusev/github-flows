// @ts-check
/**
 * @namespace Github_Flows_Execution_Preparation_Prompt_Materializer
 * @description Materializes prompt templates into resolved prompt text during execution preparation.
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

function isScalarOrNullValue(value) {
  return value === null || isScalarValue(value);
}

function normalizeOptionalDefaultValue(value) {
  return value === null ? "" : value;
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

function parsePromptVariableDefinitions(promptVariables) {
  const configuredBindings = asRecord(promptVariables);
  const usesStructured = ("required" in configuredBindings) || ("optional" in configuredBindings);

  if (!usesStructured) {
    return {
      required: configuredBindings,
      optional: {},
    };
  }

  const required = asRecord(configuredBindings.required);
  const optional = asRecord(configuredBindings.optional);

  const legacyKeys = Object.keys(configuredBindings)
    .filter((key) => (key !== "required") && (key !== "optional"));
  if (legacyKeys.length > 0) {
    throw new Error(`Legacy and structured prompt variable forms must not be mixed: ${legacyKeys[0]}`);
  }

  return { required, optional };
}

function resolvePromptBindings({ event, hostAttributes, selectedProfile, workspace }) {
  const handler = asRecord(asRecord(selectedProfile.execution).handler);
  const configuredBindings = parsePromptVariableDefinitions(handler.promptVariables);
  const sources = {
    event: asRecord(event),
    host: asRecord(hostAttributes),
    workspace: buildWorkspaceValueMap(workspace),
  };
  const resolved = {};

  for (const [variableName, sourcePath] of Object.entries(configuredBindings.required)) {
    if ((typeof variableName !== "string") || variableName.length === 0) {
      throw new Error("Prompt variable name must be a non-empty string.");
    }
    if ((typeof sourcePath !== "string") || sourcePath.length === 0) {
      throw new Error(`Prompt binding source path must be a non-empty string: ${variableName}`);
    }
    const [root] = sourcePath.split(".", 1);
    if ((root !== "event") && (root !== "host") && (root !== "workspace")) {
      throw new Error(`Unsupported prompt binding source path: ${sourcePath}`);
    }
    const value = resolvePathValue(sources, sourcePath);
    if (!isScalarValue(value)) {
      throw new Error(`Unable to resolve prompt binding to exactly one value: ${variableName} <- ${sourcePath}`);
    }
    resolved[variableName] = value;
  }

  for (const [variableName, entry] of Object.entries(configuredBindings.optional)) {
    if ((typeof variableName !== "string") || variableName.length === 0) {
      throw new Error("Prompt variable name must be a non-empty string.");
    }
    const definition = asRecord(entry);
    const sourcePath = definition.path;
    if ((typeof sourcePath !== "string") || sourcePath.length === 0) {
      throw new Error(`Optional prompt binding path must be a non-empty string: ${variableName}`);
    }
    const [root] = sourcePath.split(".", 1);
    if ((root !== "event") && (root !== "host") && (root !== "workspace")) {
      throw new Error(`Unsupported prompt binding source path: ${sourcePath}`);
    }
    const value = resolvePathValue(sources, sourcePath);
    if (isScalarValue(value)) {
      resolved[variableName] = value;
      continue;
    }
    if ("default" in definition) {
      if (!isScalarOrNullValue(definition.default)) {
        throw new Error(`Optional prompt binding default must be scalar: ${variableName}`);
      }
      resolved[variableName] = normalizeOptionalDefaultValue(definition.default);
    }
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
     *   hostAttributes?: Github_Flows_Event_Attribute__Set,
     *   loggingContext?: Github_Flows_Event_Logging_Context__Data,
     *   selectedProfile: Github_Flows_Execution_Profile__Selected,
     *   workspace: Github_Flows_Execution_Workspace
     * }} params
     * @returns {Promise<Github_Flows_Execution_Preparation_Prompt_Materializer__Result>}
     */
    this.materialize = async function ({ event, hostAttributes = {}, loggingContext, selectedProfile, workspace }) {
      const execution = asRecord(selectedProfile.execution);
      const handler = asRecord(execution.handler);
      const promptRef = requireString(handler.promptRef, "execution.handler.promptRef");
      const promptRefBaseDir = requireString(selectedProfile.promptRefBaseDir, "profile.promptRefBaseDir");
      const cfgRoot = pathModule.resolve(runtime.workspaceRoot, "cfg");
      const templatePath = pathModule.resolve(cfgRoot, promptRefBaseDir, promptRef);
      const relativeTemplatePath = pathModule.relative(cfgRoot, templatePath);
      const promptBindings = resolvePromptBindings({ event, hostAttributes, selectedProfile, workspace });

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

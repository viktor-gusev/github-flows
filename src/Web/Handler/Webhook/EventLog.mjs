// @ts-check
/**
 * @namespace Github_Flows_Web_Handler_Webhook_EventLog
 * @description Observational inbound event logger for GitHub webhook processing.
 */
const MAX_LOG_VALUE_LENGTH = 64;
const REPLACEMENT = "...";
const AUTH_HEADER_PATTERN = /(authorization|signature|secret|token)/i;
const GITHUB_HEADER_PATTERN = /^x-(github|hub)-/i;
const HTTPS_PREFIX = "https://";
const EVENT_LOG_FILENAME = "events.log";
const EVENT_SNAPSHOT_FILENAME = "event.json";
const EFFECTIVE_PROFILE_FILENAME = "effective-profile.json";
const PROMPT_BINDINGS_FILENAME = "prompt-bindings.json";

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function sanitizeValue(value) {
  if (typeof value === "string") {
    if (value.startsWith(HTTPS_PREFIX)) {
      return undefined;
    }
    return value.length > MAX_LOG_VALUE_LENGTH ? REPLACEMENT : value;
  }

  if (Array.isArray(value)) {
    return value
      .map(sanitizeValue)
      .filter((item) => item !== undefined);
  }

  if (value && typeof value === "object") {
    // Preserve nested request/detail hierarchy while applying the same bounded logging rule.
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, sanitizeValue(item)])
        .filter(([, item]) => item !== undefined),
    );
  }

  return value;
}

/**
 * @param {Record<string, string | string[] | undefined>} headers
 * @returns {Record<string, string | string[]>}
 */
function selectHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers)
      .filter(([name, value]) =>
        value !== undefined
        && GITHUB_HEADER_PATTERN.test(name)
        && !AUTH_HEADER_PATTERN.test(name)
      )
      .map(([name, value]) => [name, sanitizeValue(value)]),
  );
}

/**
 * @param {Buffer} body
 * @returns {unknown}
 */
function parseBody(body) {
  if (body.length === 0) return null;

  try {
    return sanitizeValue(JSON.parse(body.toString("utf8")));
  } catch {
    return null;
  }
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }
  if (value && (typeof value === "object")) {
    return Object.fromEntries(
      Object.entries(/** @type {Record<string, unknown>} */ (value)).map(([key, item]) => [key, cloneValue(item)]),
    );
  }
  return value;
}

/**
 * Observational inbound event logger.
 */
export default class Github_Flows_Web_Handler_Webhook_EventLog {
  /**
   * @param {object} deps
   * @param {typeof import("node:fs/promises")} deps.fsPromises
   * @param {Github_Flows_Logger} deps.logger
   * @param {typeof import("node:path")} deps.pathModule
   */
  constructor({ fsPromises, logger, pathModule }) {
    /**
     * Preserve nested object structure in the default console output instead of
     * letting Node collapse it to `[Object]`.
     *
     * @param {Github_Flows_Web_Handler_Webhook_EventLog__DecisionTraceEntry
     *   | Github_Flows_Web_Handler_Webhook_EventLog__IngressEntry
     *   | Github_Flows_Web_Handler_Webhook_EventLog__ReceptionEntry} entry
     */
    const emit = function (entry) {
      if (logger?.info) {
        logger.info(entry);
      } else {
        console.info(JSON.stringify(entry, null, 2));
      }
    };

    const ensureDirectory = async function (loggingContext) {
      await fsPromises.mkdir(loggingContext.logDirectory, { recursive: true });
    };

    const appendEvent = async function (loggingContext, entry) {
      await ensureDirectory(loggingContext);
      await fsPromises.appendFile(
        pathModule.join(loggingContext.logDirectory, EVENT_LOG_FILENAME),
        `${JSON.stringify(entry)}\n`,
        "utf8",
      );
    };

    this.logReception = function ({ body, pathname, request }) {
      emit({
        type: "github-webhook",
        stage: "reception",
        pathname,
        headers: selectHeaders(request.headers),
        body: parseBody(body),
      });
    };

    this.logIngress = function ({ outcome, reason }) {
      emit({
        type: "github-webhook",
        stage: "ingress",
        outcome,
        reason: sanitizeValue(reason),
      });
    };

    this.logDecisionTrace = async function ({ decision, decisionBasis, loggingContext, resolutionInputs }) {
      const entry = {
        type: "github-webhook",
        stage: "decision-trace",
        resolutionInputs: sanitizeValue(resolutionInputs),
        decisionBasis: sanitizeValue(decisionBasis),
        decision,
      };

      emit(entry);
      if (loggingContext) {
        await appendEvent(loggingContext, {
          ...entry,
          loggedAt: new Date().toISOString(),
        });
      }
    };

    /**
     * @param {{
     *   loggingContext: Github_Flows_Event_Logging_Context__Data,
     *   headers?: Record<string, string | string[] | undefined>,
     *   payload: unknown,
     * }} params
     */
    this.persistEventSnapshot = async function ({ headers = {}, loggingContext, payload }) {
      await ensureDirectory(loggingContext);
      await fsPromises.writeFile(
        pathModule.join(loggingContext.logDirectory, EVENT_SNAPSHOT_FILENAME),
        `${JSON.stringify({
          body: cloneValue(payload),
          headers: selectHeaders(headers),
        }, null, 2)}\n`,
        "utf8",
      );
    };

    /**
     * @param {{
     *   loggingContext: Github_Flows_Event_Logging_Context__Data,
     *   selectedProfile: Github_Flows_Execution_Profile__Selected,
     * }} params
     */
    this.persistEffectiveProfile = async function ({ loggingContext, selectedProfile }) {
      await ensureDirectory(loggingContext);
      await fsPromises.writeFile(
        pathModule.join(loggingContext.logDirectory, EFFECTIVE_PROFILE_FILENAME),
        `${JSON.stringify(cloneValue(selectedProfile), null, 2)}\n`,
        "utf8",
      );
    };

    /**
     * @param {{
     *   bindings: Record<string, string | number | boolean>,
     *   loggingContext: Github_Flows_Event_Logging_Context__Data,
     * }} params
     */
    this.persistPromptBindings = async function ({ bindings, loggingContext }) {
      await ensureDirectory(loggingContext);
      await fsPromises.writeFile(
        pathModule.join(loggingContext.logDirectory, PROMPT_BINDINGS_FILENAME),
        `${JSON.stringify(cloneValue(bindings), null, 2)}\n`,
        "utf8",
      );
    };

    /**
     * @param {{
     *   action: string,
     *   component: string,
     *   details?: unknown,
     *   loggingContext: Github_Flows_Event_Logging_Context__Data,
     *   message: string,
     *   stage?: string,
     * }} entry
     */
    this.logEventProcessing = async function ({ action, component, details, loggingContext, message, stage = "event-processing" }) {
      await appendEvent(loggingContext, {
        type: "github-flows",
        stage,
        component,
        action,
        details: cloneValue(details),
        message,
        loggedAt: new Date().toISOString(),
      });
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({
    fsPromises: "node:fs/promises",
    logger: "Github_Flows_Logger$",
    pathModule: "node:path",
  }),
});

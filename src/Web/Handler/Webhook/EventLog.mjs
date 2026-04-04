/**
 * Observational inbound event logger for GitHub webhook processing.
 */
const MAX_LOG_VALUE_LENGTH = 64;
const REPLACEMENT = "...";
const AUTH_HEADER_PATTERN = /(authorization|signature|secret|token)/i;
const GITHUB_HEADER_PATTERN = /^x-(github|hub)-/i;
const HTTPS_PREFIX = "https://";

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
 * Observational inbound event logger.
 */
export default class Github_Flows_Web_Handler_Webhook_EventLog {
  /**
   * @param {object} deps
   * @param {Github_Flows_Logger} deps.logger
   */
  constructor({ logger }) {
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

    this.logDecisionTrace = function ({ decision, decisionBasis, resolutionInputs }) {
      emit({
        type: "github-webhook",
        stage: "decision-trace",
        resolutionInputs: sanitizeValue(resolutionInputs),
        decisionBasis: sanitizeValue(decisionBasis),
        decision,
      });
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({
    logger: "Github_Flows_Logger$",
  }),
});

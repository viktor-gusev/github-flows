// @ts-check
/**
 * @namespace Github_Flows_Event_Logging_Context
 * @description Builds event-scoped logging context for one admitted GitHub event.
 */
const LOG_BRANCH = ["log", "run"];

function sanitizePathSegment(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (trimmed.length === 0) return fallback;
  const normalized = trimmed.replaceAll(/[^A-Za-z0-9._-]+/g, "_").replaceAll(/^[_./-]+|[_./-]+$/g, "");
  return normalized.length > 0 ? normalized : fallback;
}

function buildFallbackEventId(nowFactory, randomIntFactory) {
  const date = nowFactory();
  const yyyy = date.getUTCFullYear().toString();
  const yy = yyyy.slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  const rand = String(randomIntFactory(10000)).padStart(4, "0");
  return `${yy}${mm}${dd}-${hh}${mi}${ss}-${rand}`;
}

function asRecord(value) {
  if (value && (typeof value === "object") && !Array.isArray(value)) {
    return /** @type {Record<string, unknown>} */ (value);
  }
  return {};
}

function extractIdentity(repository) {
  const repo = asRecord(repository);
  const owner = asRecord(repo.owner).login;
  const name = repo.name;

  if ((typeof owner !== "string") || owner.length === 0) {
    throw new Error("GitHub repository owner login is missing in event payload.");
  }
  if ((typeof name !== "string") || name.length === 0) {
    throw new Error("GitHub repository name is missing in event payload.");
  }

  return {
    owner: sanitizePathSegment(owner, "owner"),
    repo: sanitizePathSegment(name, "repo"),
  };
}

function extractEventType(headers, payload) {
  const eventHeader = headers["x-github-event"];
  const body = asRecord(payload);
  const value = typeof eventHeader === "string"
    ? eventHeader
    : body.event_type ?? body.eventType ?? body.type ?? body.action;
  return sanitizePathSegment(typeof value === "string" ? value : "event", "event");
}

function extractEventId(headers, payload, nowFactory, randomIntFactory) {
  const deliveryHeader = headers["x-github-delivery"];
  if ((typeof deliveryHeader === "string") && deliveryHeader.length > 0) {
    return sanitizePathSegment(deliveryHeader, "event");
  }

  const body = asRecord(payload);
  const value = body.eventId ?? body.event_id ?? body.delivery ?? body.deliveryId ?? body.id;
  if ((typeof value === "string") || (typeof value === "number")) {
    return sanitizePathSegment(String(value), "event");
  }

  return buildFallbackEventId(nowFactory, randomIntFactory);
}

export default class Github_Flows_Event_Logging_Context {
  /**
   * @param {object} deps
   * @param {typeof import("node:path")} deps.pathModule
   * @param {Github_Flows_Config_Runtime} deps.runtime
   * @param {() => Date} [deps.nowFactory]
   * @param {(upperBound: number) => number} [deps.randomIntFactory]
   */
  constructor({
    nowFactory = () => new Date(),
    pathModule,
    randomIntFactory = (upperBound) => Math.floor(Math.random() * upperBound),
    runtime,
  }) {
    /**
     * @param {{
     *   headers?: Record<string, string | string[] | undefined>,
     *   payload: unknown,
     * }} params
     * @returns {Github_Flows_Event_Logging_Context__Data}
     */
    this.createByGithubEvent = function ({ headers = {}, payload }) {
      const { owner, repo } = extractIdentity(asRecord(payload).repository);
      const eventType = extractEventType(headers, payload);
      const eventId = extractEventId(headers, payload, nowFactory, randomIntFactory);
      const logDirectory = pathModule.resolve(runtime.workspaceRoot, ...LOG_BRANCH, owner, repo, eventType, eventId);

      return {
        eventId,
        eventType,
        logDirectory,
        owner,
        repo,
      };
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({
    pathModule: "node:path",
    runtime: "Github_Flows_Config_Runtime$",
  }),
});

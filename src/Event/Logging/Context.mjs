// @ts-check
/**
 * @namespace Github_Flows_Event_Logging_Context
 * @description Builds event-scoped logging context for one admitted event model.
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

function extractIdentity(repository) {
  const owner = repository.ownerLogin;
  const name = repository.name;

  if ((typeof owner !== "string") || owner.length === 0) {
    throw new Error("GitHub repository owner login is missing in admitted event model.");
  }
  if ((typeof name !== "string") || name.length === 0) {
    throw new Error("GitHub repository name is missing in admitted event model.");
  }

  return {
    owner: sanitizePathSegment(owner, "owner"),
    repo: sanitizePathSegment(name, "repo"),
  };
}

function extractEventType(eventModel) {
  return sanitizePathSegment(eventModel.event, "event");
}

function extractEventId(eventModel, nowFactory, randomIntFactory) {
  const deliveryId = eventModel.deliveryId;
  if (((typeof deliveryId === "string") && deliveryId.length > 0) || (typeof deliveryId === "number")) {
    return sanitizePathSegment(String(deliveryId), "event");
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
     * @param {Github_Flows_Event_Model__Data} eventModel
     * @returns {Github_Flows_Event_Logging_Context__Data}
     */
    this.createByEventModel = function (eventModel) {
      const { owner, repo } = extractIdentity(eventModel.repository);
      const eventType = extractEventType(eventModel);
      const eventId = extractEventId(eventModel, nowFactory, randomIntFactory);
      const logDirectory = pathModule.resolve(runtime.workspaceRoot, ...LOG_BRANCH, owner, repo, eventId);

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

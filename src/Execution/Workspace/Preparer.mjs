// @ts-check
/**
 * @namespace Github_Flows_Execution_Workspace_Preparer
 * @description Prepares isolated execution workspaces for containerized agent runs.
 */

/* Executes external command through injected child-process module. */
async function runCommand(childProcess, command, args) {
  return await new Promise((resolve, reject) => {
    childProcess.execFile(command, args, (error, stdout = "", stderr = "") => {
      if (error) reject(error);
      else resolve({ stderr, stdout });
    });
  });
}

/* Extracts stable GitHub repository identity from event payload. */
function extractIdentity(repository) {
  if ((repository === null) || (typeof repository !== "object")) {
    throw new Error("GitHub event payload does not contain a repository object.");
  }
  const repo = /** @type {{ id?: number | string, name?: string, owner?: { login?: string } }} */ (repository);
  const owner = repo.owner?.login;
  const name = repo.name;
  if ((typeof owner !== "string") || owner.length === 0) {
    throw new Error("GitHub repository owner login is missing in event payload.");
  }
  if ((typeof name !== "string") || name.length === 0) {
    throw new Error("GitHub repository name is missing in event payload.");
  }
  return { githubRepoId: repo.id, owner, repo: name };
}

/* Converts event-derived values into safe filesystem path segments. */
function sanitizePathSegment(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (trimmed.length === 0) return fallback;
  const normalized = trimmed.replaceAll(/[^A-Za-z0-9._-]+/g, "_").replaceAll(/^[_./-]+|[_./-]+$/g, "");
  return normalized.length > 0 ? normalized : fallback;
}

/* Formats execution fallback id as YYMMDD-HHMMSS-RRRR. */
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

/* Resolves event type segment for the execution workspace path. */
function extractEventType(event) {
  const payload = /** @type {{ event_type?: unknown, eventType?: unknown, type?: unknown, action?: unknown }} */ (event);
  const value = payload.event_type ?? payload.eventType ?? payload.type ?? payload.action;
  return sanitizePathSegment(typeof value === "string" ? value : "event", "event");
}

/* Resolves event id segment for the execution workspace path. */
function extractEventId(event, nowFactory, randomIntFactory) {
  const payload = /** @type {{ eventId?: unknown, event_id?: unknown, delivery?: unknown, deliveryId?: unknown, id?: unknown }} */ (event);
  const value = payload.eventId ?? payload.event_id ?? payload.delivery ?? payload.deliveryId ?? payload.id;
  if ((typeof value === "string") || (typeof value === "number")) {
    return sanitizePathSegment(String(value), "event");
  }
  return buildFallbackEventId(nowFactory, randomIntFactory);
}

/* Ensures that the target workspace path does not already exist. */
async function assertWorkspaceIsAbsent(fsPromises, target) {
  try {
    await fsPromises.stat(target);
  } catch (error) {
    // @ts-ignore
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Execution workspace already exists: ${target}`);
}

/**
 * Isolated execution workspace preparer.
 */
export default class Github_Flows_Execution_Workspace_Preparer {
  /**
   * @param {object} deps
   * @param {typeof import("node:child_process")} deps.childProcess
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
   * @param {typeof import("node:fs/promises")} deps.fsPromises
   * @param {typeof import("node:path")} deps.pathModule
   * @param {Github_Flows_Repo_Cache_Manager} deps.repoCacheManager
   * @param {Github_Flows_Config_Runtime} deps.runtime
   * @param {() => Date} [deps.nowFactory]
   * @param {(upperBound: number) => number} [deps.randomIntFactory]
   */
   constructor({
    childProcess,
    eventLog,
    fsPromises,
    logger,
    nowFactory = () => new Date(),
    pathModule,
    randomIntFactory = (upperBound) => Math.floor(Math.random() * upperBound),
    repoCacheManager,
    runtime,
  }) {
    /**
     * @param {{ event: unknown, loggingContext?: Github_Flows_Event_Logging_Context__Data }} params
     * @returns {Promise<{
     *   eventId: string,
     *   eventType: string,
     *   githubRepoId: number | string | undefined,
     *   owner: string,
     *   repo: string,
     *   repoPath: string,
     *   repositoryCachePath: string,
     *   workspaceRoot: string,
     *   workspacePath: string
     * }>}
     */
    this.prepareByGithubEvent = async function ({ event, loggingContext }) {
      const payload = /** @type {{ repository?: unknown }} */ (event);
      const identity = loggingContext
        ? { owner: loggingContext.owner, repo: loggingContext.repo }
        : extractIdentity(payload.repository);
      const eventType = loggingContext?.eventType ?? extractEventType(event);
      const eventId = loggingContext?.eventId ?? extractEventId(event, nowFactory, randomIntFactory);
      const workspacePath = pathModule.resolve(
        runtime.workspaceRoot,
        "ws",
        identity.owner,
        identity.repo,
        eventType,
        eventId,
      );
      const repoPath = pathModule.join(workspacePath, "repo");
      const cacheEntry = await repoCacheManager.syncByGithubEvent({ event });

      await assertWorkspaceIsAbsent(fsPromises, workspacePath);
      await fsPromises.mkdir(workspacePath, { recursive: true });
      logger?.logComponentAction?.({
        component: "Github_Flows_Execution_Workspace_Preparer",
        action: "workspace-create",
        details: { eventId, eventType, owner: identity.owner, repo: identity.repo, workspacePath },
        message: `Created execution workspace for ${identity.owner}/${identity.repo}.`,
      });
      await eventLog?.logEventProcessing?.({
        action: "workspace-create",
        component: "Github_Flows_Execution_Workspace_Preparer",
        details: { eventId, eventType, owner: identity.owner, repo: identity.repo, workspacePath },
        loggingContext,
        message: `Created execution workspace for ${identity.owner}/${identity.repo}.`,
        stage: "execution-preparation",
      });

      await runCommand(childProcess, "git", ["clone", "--no-hardlinks", cacheEntry.path, repoPath]);
      logger?.logComponentAction?.({
        component: "Github_Flows_Execution_Workspace_Preparer",
        action: "workspace-repo-clone",
        details: {
          owner: identity.owner,
          repo: identity.repo,
          repositoryCachePath: cacheEntry.path,
          repoPath,
          workspacePath,
        },
        message: `Cloned repository into execution workspace for ${identity.owner}/${identity.repo}.`,
      });
      await eventLog?.logEventProcessing?.({
        action: "workspace-repo-clone",
        component: "Github_Flows_Execution_Workspace_Preparer",
        details: {
          owner: identity.owner,
          repo: identity.repo,
          repositoryCachePath: cacheEntry.path,
          repoPath,
          workspacePath,
        },
        loggingContext,
        message: `Cloned repository into execution workspace for ${identity.owner}/${identity.repo}.`,
        stage: "execution-preparation",
      });

      try {
        const { stdout } = await runCommand(childProcess, "git", [
          "-C",
          cacheEntry.path,
          "remote",
          "get-url",
          "origin",
        ]);
        const originUrl = stdout.trim();
        if (originUrl.length > 0) {
          await runCommand(childProcess, "git", ["-C", repoPath, "remote", "set-url", "origin", originUrl]);
        }
      } catch {
        // Keep the cloned repository usable even if cache origin is unavailable.
      }

      return {
        eventId,
        eventType,
        githubRepoId: identity.githubRepoId,
        owner: identity.owner,
        repo: identity.repo,
        repoPath,
        repositoryCachePath: cacheEntry.path,
        workspaceRoot: runtime.workspaceRoot,
        workspacePath,
      };
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({
    childProcess: "node:child_process",
    eventLog: "Github_Flows_Web_Handler_Webhook_EventLog$",
    fsPromises: "node:fs/promises",
    logger: "Github_Flows_Logger$",
    pathModule: "node:path",
    repoCacheManager: "Github_Flows_Repo_Cache_Manager$",
    runtime: "Github_Flows_Config_Runtime$",
  }),
});

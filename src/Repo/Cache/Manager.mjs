// @ts-check
/**
 * @namespace Github_Flows_Repo_Cache_Manager
 * @description Maintains shared local repository cache entries for GitHub repositories.
 */

/* Executes external command through injected child-process module. */
async function runCommand(childProcess, command, args) {
  await new Promise((resolve, reject) => {
    childProcess.execFile(command, args, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

/* Detects whether the cache target already contains a git repository. */
async function isGitRepository(fsPromises, pathModule, target) {
  try {
    await fsPromises.stat(target);
  } catch (error) {
    // @ts-ignore
    if (error?.code === "ENOENT") return false;
    throw error;
  }

  try {
    await fsPromises.stat(pathModule.join(target, ".git"));
    return true;
  } catch (error) {
    // @ts-ignore
    if (error?.code === "ENOENT") {
      throw new Error(`Repository cache path exists but is not a git repository: ${target}`);
    }
    throw error;
  }
}

/* Extracts stable GitHub repository identity from webhook payload. */
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

/**
 * Shared GitHub repository cache manager.
 */
export default class Github_Flows_Repo_Cache_Manager {
  /**
   * @param {object} deps
    * @param {typeof import("node:child_process")} deps.childProcess
   * @param {{ logComponentAction?: (entry: {
   *   action: string,
   *   component: string,
   *   details?: unknown,
   *   message: string
   * }) => void }} [deps.logger]
   * @param {typeof import("node:fs/promises")} deps.fsPromises
   * @param {typeof import("node:path")} deps.pathModule
   * @param {Github_Flows_Config_Runtime} deps.runtime
   */
  constructor({ childProcess, fsPromises, logger, pathModule, runtime }) {
    /**
     * @param {{ event: unknown }} params
     * @returns {Promise<{ action: "clone" | "pull", githubRepoId: number | string | undefined, owner: string, repo: string, path: string }>}
     */
    this.syncByGithubEvent = async function ({ event }) {
      const payload = /** @type {{ repository?: unknown }} */ (event);
      const identity = extractIdentity(payload.repository);
      const repoRoot = pathModule.resolve(runtime.workspaceRoot, "cache", "repo", identity.owner);
      const repoPath = pathModule.join(repoRoot, identity.repo);
      const cloneRef = `${identity.owner}/${identity.repo}`;

      await fsPromises.mkdir(repoRoot, { recursive: true });

      if (await isGitRepository(fsPromises, pathModule, repoPath)) {
        await runCommand(childProcess, "git", ["-C", repoPath, "pull", "--ff-only", "--depth=1"]);
        logger?.logComponentAction?.({
          component: "Github_Flows_Repo_Cache_Manager",
          action: "pull",
          details: { owner: identity.owner, path: repoPath, repo: identity.repo },
          message: `Updated repository cache for ${identity.owner}/${identity.repo}.`,
        });
        return { action: "pull", ...identity, path: repoPath };
      }

      await runCommand(childProcess, "gh", [
        "repo",
        "clone",
        cloneRef,
        repoPath,
        "--",
        "--depth=1",
        "--single-branch",
        "--no-tags",
      ]);
      logger?.logComponentAction?.({
        component: "Github_Flows_Repo_Cache_Manager",
        action: "clone",
        details: { owner: identity.owner, path: repoPath, repo: identity.repo },
        message: `Cloned repository cache for ${identity.owner}/${identity.repo}.`,
      });
      return { action: "clone", ...identity, path: repoPath };
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({
    childProcess: "node:child_process",
    fsPromises: "node:fs/promises",
    logger: "Github_Flows_Logger$",
    pathModule: "node:path",
    runtime: "Github_Flows_Config_Runtime$",
  }),
});

// @ts-check
/**
 * @namespace Github_Flows_Repo_Cache_Manager
 * @description Maintains shared local repository cache entries for GitHub repositories.
 */

/* Builds a non-interactive git auth env from host-provided token variables. */
function buildGitAuthEnv(baseEnv = process.env) {
  const token = baseEnv.GH_TOKEN ?? baseEnv.GITHUB_TOKEN;
  if (typeof token !== "string" || token.length === 0) {
    return baseEnv;
  }

  return {
    ...baseEnv,
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "credential.helper",
    GIT_CONFIG_VALUE_0: `!f() { printf 'username=x-access-token\npassword=%s\n' "$GH_TOKEN"; }; f`,
  };
}

/* Executes external command through injected child-process module. */
async function runCommand(childProcess, command, args, options = {}) {
  await new Promise((resolve, reject) => {
    childProcess.execFile(command, args, options, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

/* Removes one cache entry so it can be recreated from remote origin. */
async function recreateCacheDirectory(fsPromises, target) {
  await fsPromises.rm(target, { recursive: true, force: true });
}

/* Clones a remote repository into the cache path. */
async function cloneRepositoryCache(childProcess, cloneRef, repoPath, gitAuthEnv) {
  await runCommand(childProcess, "gh", [
    "repo",
    "clone",
    cloneRef,
    repoPath,
    "--",
    "--depth=1",
    "--single-branch",
    "--no-tags",
  ], { env: gitAuthEnv });
}

/* Waits without blocking the event loop. */
async function sleepDefault(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/* Builds per-repository lock path inside workspace cache root. */
function buildLockPath(pathModule, workspaceRoot, owner, repo) {
  return pathModule.resolve(workspaceRoot, "cache", "lock", owner, `${repo}.lock`);
}

/* Reads lock owner metadata when available. */
async function readLockMetadata(fsPromises, pathModule, lockPath) {
  try {
    const content = await fsPromises.readFile(pathModule.join(lockPath, "owner.json"), "utf8");
    return JSON.parse(content);
  } catch (error) {
    // @ts-ignore
    if (error?.code === "ENOENT") return undefined;
    return undefined;
  }
}

/* Acquires an exclusive per-repository lock with stale-lock recovery. */
async function acquireRepositoryLock({
  fsPromises,
  logger,
  nowFactory,
  owner,
  pathModule,
  pollIntervalMs,
  repo,
  staleMs,
  sleep,
  timeoutMs,
  workspaceRoot,
}) {
  const lockPath = buildLockPath(pathModule, workspaceRoot, owner, repo);
  const lockRoot = pathModule.dirname(lockPath);
  const startedAt = nowFactory();
  await fsPromises.mkdir(lockRoot, { recursive: true });

  while (true) {
    try {
      await fsPromises.mkdir(lockPath);
      const acquiredAt = nowFactory();
      await fsPromises.writeFile(pathModule.join(lockPath, "owner.json"), JSON.stringify({
        acquiredAt: acquiredAt.toISOString(),
        pid: process.pid,
      }), "utf8");
      logger?.logComponentAction?.({
        component: "Github_Flows_Repo_Cache_Manager",
        action: "cache-lock-acquired",
        details: { lockPath, owner, repo },
        message: `Acquired repository cache lock for ${owner}/${repo}.`,
      });
      return lockPath;
    } catch (error) {
      // @ts-ignore
      if (error?.code !== "EEXIST") throw error;
    }

    const now = nowFactory();
    const waitedMs = now.getTime() - startedAt.getTime();
    const metadata = await readLockMetadata(fsPromises, pathModule, lockPath);
    const acquiredAt = typeof metadata?.acquiredAt === "string" ? Date.parse(metadata.acquiredAt) : Number.NaN;
    const lockAgeMs = Number.isFinite(acquiredAt) ? now.getTime() - acquiredAt : 0;
    if (lockAgeMs >= staleMs) {
      await fsPromises.rm(lockPath, { recursive: true, force: true });
      logger?.logComponentAction?.({
        component: "Github_Flows_Repo_Cache_Manager",
        action: "cache-lock-stale-removed",
        details: { lockPath, owner, repo },
        message: `Removed stale repository cache lock for ${owner}/${repo}.`,
      });
      continue;
    }
    if (waitedMs >= timeoutMs) {
      throw new Error(`Timed out waiting for repository cache lock: ${owner}/${repo}`);
    }
    logger?.logComponentAction?.({
      component: "Github_Flows_Repo_Cache_Manager",
      action: "cache-lock-wait",
      details: { lockPath, owner, repo, waitedMs },
      message: `Waiting for repository cache lock for ${owner}/${repo}.`,
    });
    await sleep(pollIntervalMs);
  }
}

/* Releases one per-repository lock path if it is still owned by the current synchronizer. */
async function releaseRepositoryLock(fsPromises, logger, lockPath, owner, repo) {
  await fsPromises.rm(lockPath, { recursive: true, force: true });
  logger?.logComponentAction?.({
    component: "Github_Flows_Repo_Cache_Manager",
    action: "cache-lock-released",
    details: { lockPath, owner, repo },
    message: `Released repository cache lock for ${owner}/${repo}.`,
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
  constructor({ childProcess, fsPromises, logger, nowFactory = () => new Date(), pathModule, runtime, sleep = sleepDefault }) {
    /**
     * @param {{ event: unknown }} params
     * @returns {Promise<{ action: "clone" | "pull" | "reclone", githubRepoId: number | string | undefined, owner: string, repo: string, path: string }>}
     */
    this.syncByGithubEvent = async function ({ event }) {
      const payload = /** @type {{ repository?: unknown }} */ (event);
      const identity = extractIdentity(payload.repository);
      const repoRoot = pathModule.resolve(runtime.workspaceRoot, "cache", "repo", identity.owner);
      const repoPath = pathModule.join(repoRoot, identity.repo);
      const cloneRef = `${identity.owner}/${identity.repo}`;
      const gitAuthEnv = buildGitAuthEnv();
      const lockPath = await acquireRepositoryLock({
        fsPromises,
        logger,
        nowFactory,
        owner: identity.owner,
        pathModule,
        pollIntervalMs: runtime.repoCacheLockPollIntervalMs ?? 1000,
        repo: identity.repo,
        staleMs: runtime.repoCacheLockStaleMs ?? 600000,
        sleep,
        timeoutMs: runtime.repoCacheLockTimeoutMs ?? 60000,
        workspaceRoot: runtime.workspaceRoot,
      });

      try {
        await fsPromises.mkdir(repoRoot, { recursive: true });

        if (await isGitRepository(fsPromises, pathModule, repoPath)) {
          try {
            await runCommand(childProcess, "git", ["-C", repoPath, "pull", "--ff-only", "--depth=1"], { env: gitAuthEnv });
            logger?.logComponentAction?.({
              component: "Github_Flows_Repo_Cache_Manager",
              action: "pull",
              details: { owner: identity.owner, path: repoPath, repo: identity.repo },
              message: `Updated repository cache for ${identity.owner}/${identity.repo}.`,
            });
            return { action: "pull", ...identity, path: repoPath };
          } catch (_error) {
            await recreateCacheDirectory(fsPromises, repoPath);
            await cloneRepositoryCache(childProcess, cloneRef, repoPath, gitAuthEnv);
            logger?.logComponentAction?.({
              component: "Github_Flows_Repo_Cache_Manager",
              action: "reclone",
              details: { owner: identity.owner, path: repoPath, recovery: "pull-failed", repo: identity.repo },
              message: `Recreated repository cache for ${identity.owner}/${identity.repo} after pull failed.`,
            });
            return { action: "reclone", ...identity, path: repoPath };
          }
        }

        await cloneRepositoryCache(childProcess, cloneRef, repoPath, gitAuthEnv);
        logger?.logComponentAction?.({
          component: "Github_Flows_Repo_Cache_Manager",
          action: "clone",
          details: { owner: identity.owner, path: repoPath, repo: identity.repo },
          message: `Cloned repository cache for ${identity.owner}/${identity.repo}.`,
        });
        return { action: "clone", ...identity, path: repoPath };
      } finally {
        await releaseRepositoryLock(fsPromises, logger, lockPath, identity.owner, identity.repo);
      }
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

// @ts-check
/**
 * @namespace Github_Flows_Execution_Profile_Resolver
 * @description Scans cfg fragments and resolves one effective candidate profile for an event.
 */
const PROFILE_FILENAME = "profile.json";

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function asRecord(value) {
  if (value && (typeof value === "object") && !Array.isArray(value)) {
    return /** @type {Record<string, unknown>} */ (value);
  }
  return {};
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
 * @param {unknown} base
 * @param {unknown} override
 * @returns {Record<string, unknown>}
 */
function deepMerge(base, override) {
  const left = asRecord(base);
  const right = asRecord(override);
  const merged = {};
  for (const [key, value] of Object.entries(left)) {
    merged[key] = cloneValue(value);
  }
  for (const [key, value] of Object.entries(right)) {
    const previous = merged[key];
    if (
      previous
      && value
      && (typeof previous === "object")
      && !Array.isArray(previous)
      && (typeof value === "object")
      && !Array.isArray(value)
    ) {
      merged[key] = deepMerge(previous, value);
    } else {
      merged[key] = cloneValue(value);
    }
  }
  return merged;
}

/**
 * @param {{ trigger?: unknown, execution?: unknown, directory?: string }[]} fragments
 * @returns {{
 *   execution: Record<string, unknown>,
 *   promptRefBaseDir: string | undefined,
 *   trigger: Record<string, unknown>,
 *   type: string | undefined
 * }}
 */
function mergeCandidateFragments(fragments) {
  return fragments.reduce((result, fragment) => {
    const trigger = {
      ...result.trigger,
      ...asRecord(fragment.trigger),
    };
    const execution = deepMerge(result.execution, fragment.execution);
    const runtime = asRecord(asRecord(fragment.execution).runtime);
    const type = typeof runtime.type === "string" ? runtime.type : result.type;
    const nextHandler = asRecord(asRecord(fragment.execution).handler);
    const promptRefBaseDir = typeof nextHandler.promptRef === "string" ? fragment.directory : result.promptRefBaseDir;
    return { execution, promptRefBaseDir, trigger, type };
  }, { trigger: {}, execution: {}, type: undefined, promptRefBaseDir: undefined });
}

/**
 * @param {string} pathValue
 * @returns {string}
 */
function normalizeRelativePath(pathValue) {
  return pathValue.length === 0 ? "." : pathValue.split("\\").join("/");
}

/**
 * @param {string} relativePath
 * @returns {string}
 */
function dirnameOf(relativePath) {
  if (relativePath === ".") return ".";
  const normalized = normalizeRelativePath(relativePath);
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash === -1 ? "." : normalized.slice(0, lastSlash);
}

/**
 * @param {string} relativeDir
 * @returns {string}
 */
function toCandidateId(relativeDir) {
  return normalizeRelativePath(relativeDir === "." ? PROFILE_FILENAME : `${relativeDir}/${PROFILE_FILENAME}`);
}

/**
 * @param {typeof import("node:path")} pathModule
 * @param {string} cfgRoot
 * @param {string} relativeDir
 * @returns {string}
 */
function toCandidateDirectoryPath(pathModule, cfgRoot, relativeDir) {
  return normalizeRelativePath(pathModule.resolve(cfgRoot, relativeDir === "." ? "" : relativeDir));
}

/**
 * @param {{
 *   headers: Record<string, string | string[] | undefined>,
 *   payload: unknown
 * }} params
 * @returns {{ action: string | undefined, event: string | undefined, repository: string | undefined }}
 */
function buildEventAttributes({ headers, payload }) {
  const body = asRecord(payload);
  const repository = asRecord(body.repository);
  const repositoryOwner = asRecord(repository.owner);
  const repositoryName = typeof repository.full_name === "string"
    ? repository.full_name
    : ((typeof repositoryOwner.login === "string") && (typeof repository.name === "string"))
        ? `${repositoryOwner.login}/${repository.name}`
        : undefined;

  return {
    action: typeof body.action === "string" ? body.action : undefined,
    event: typeof headers["x-github-event"] === "string" ? headers["x-github-event"] : undefined,
    repository: repositoryName,
  };
}

/**
 * @param {Record<string, unknown>} trigger
 * @returns {number}
 */
function computeSpecificity(trigger) {
  return Object.values(trigger).filter((value) => value !== undefined).length;
}

/**
 * @param {Record<string, unknown>} trigger
 * @param {Record<string, unknown>} attributes
 * @returns {boolean}
 */
function matchesTrigger(trigger, attributes) {
  return Object.entries(trigger).every(([key, value]) => attributes[key] === value);
}

export default class Github_Flows_Execution_Profile_Resolver {
  /**
   * @param {object} deps
   * @param {typeof import("node:fs/promises")} deps.fsPromises
   * @param {{ logComponentAction?: (entry: {
   *   action: string,
   *   component: string,
   *   details?: unknown,
   *   message: string
   * }) => void }} [deps.logger]
   * @param {typeof import("node:path")} deps.pathModule
   * @param {Github_Flows_Config_Runtime} deps.runtime
   */
  constructor({ fsPromises, logger, pathModule, runtime }) {
    /**
     * @returns {string}
     */
    const resolveCfgRoot = function () {
      return pathModule.resolve(runtime.workspaceRoot, "cfg");
    };

    /**
     * @param {string} absolutePath
     * @returns {Promise<{
     *   execution: Record<string, unknown>,
     *   directory: string,
     *   trigger: Record<string, unknown>
     * }>}
     */
    const readFragment = async function (absolutePath) {
      const content = await fsPromises.readFile(absolutePath, "utf8");
      const parsed = JSON.parse(content);
      return {
        execution: asRecord(asRecord(parsed).execution),
        directory: pathModule.dirname(pathModule.relative(resolveCfgRoot(), absolutePath)).split("\\").join("/"),
        trigger: asRecord(asRecord(parsed).trigger),
      };
    };

    /**
     * @returns {Promise<{
     *   fragments: Map<string, { absolutePath: string, directory: string }>,
     *   root: string
     * }>}
     */
    const scanFragments = async function () {
      const root = resolveCfgRoot();
      const discovered = new Map();

      /**
       * @param {string} directory
       * @param {string} [relativeDir]
       * @returns {Promise<void>}
       */
      const walk = async function (directory, relativeDir = ".") {
        let entries;
        try {
          entries = await fsPromises.readdir(directory, { withFileTypes: true });
        } catch (error) {
          // @ts-ignore
          if (error?.code === "ENOENT") return;
          throw error;
        }

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const nextRelative = relativeDir === "." ? entry.name : pathModule.join(relativeDir, entry.name);
            await walk(pathModule.join(directory, entry.name), nextRelative);
          } else if (entry.isFile() && entry.name === PROFILE_FILENAME) {
            const normalizedRelative = normalizeRelativePath(relativeDir);
            discovered.set(normalizedRelative, {
              absolutePath: pathModule.join(directory, entry.name),
              directory: normalizedRelative,
            });
          }
        }
      };

      await walk(root);
      return { fragments: discovered, root };
    };

    /**
     * @returns {Promise<{
     *   filesystemPath: string,
     *   id: string,
     *   orderKey: string,
     *   fragments: string[],
     *   profile: {
     *     execution: Record<string, unknown>,
     *     promptRefBaseDir: string | undefined,
     *     trigger: Record<string, unknown>,
     *     type: string | undefined
     *   }
     * }[]>}
     */
    const buildCandidates = async function () {
      const { fragments, root } = await scanFragments();
      const fragmentDirectories = Array.from(fragments.keys()).sort();
      const candidates = [];

      for (const candidateDirectory of fragmentDirectories) {
        const chain = [];
        let cursor = candidateDirectory;
        while (cursor !== ".") {
          const fragment = fragments.get(cursor);
          if (fragment) chain.unshift(fragment);
          cursor = dirnameOf(cursor);
        }
        if (fragments.has(".")) {
          chain.unshift(fragments.get("."));
        }
        const loaded = [];
        for (const fragment of chain) {
          loaded.push({
            directory: fragment.directory,
            fragment: await readFragment(fragment.absolutePath),
          });
        }
        candidates.push({
          filesystemPath: toCandidateDirectoryPath(pathModule, root, candidateDirectory),
          id: toCandidateId(candidateDirectory),
          orderKey: toCandidateId(candidateDirectory),
          fragments: loaded.map((item) => item.directory),
          profile: mergeCandidateFragments(loaded.map((item) => item.fragment)),
        });
      }

      candidates.sort((left, right) => left.orderKey.localeCompare(right.orderKey));
      logger?.logComponentAction?.({
        component: "Github_Flows_Execution_Profile_Resolver",
        action: "build-candidate-profile-registry",
        details: {
          cfgRoot: root,
          constructedCandidates: candidates.map((candidate) => ({
            filesystemPath: candidate.filesystemPath,
            fragments: candidate.fragments,
            id: candidate.id,
            orderKey: candidate.orderKey,
          })),
          discoveredProfileFiles: fragmentDirectories.map((directory) => {
            const fragment = fragments.get(directory);
            return {
              directory,
              path: fragment?.absolutePath,
            };
          }),
          workspaceRoot: runtime.workspaceRoot,
        },
        message: `Built candidate profile registry from ${root}.`,
      });
      return candidates;
    };

    /**
     * @param {{
     *   eventAttributes: Record<string, unknown>,
     *   loggingContext?: Github_Flows_Event_Logging_Context__Data
     * }} params
     * @returns {Promise<{
     *   applicabilityBasis: Record<string, unknown> | null,
     *   candidates: { id: string, orderKey: string, trigger: Record<string, unknown> }[],
     *   eventAttributes: Record<string, unknown>,
     *   matchedCandidates: { id: string, orderKey: string, specificity: number, trigger: Record<string, unknown> }[],
     *   selectedProfile: Github_Flows_Execution_Profile__Selected | null
     * }>}
     */
    this.resolveByEventAttributes = async function ({ eventAttributes, loggingContext }) {
      const candidates = await buildCandidates();
      const matches = candidates
        .filter((candidate) => matchesTrigger(candidate.profile.trigger, eventAttributes))
        .map((candidate) => ({
          ...candidate,
          specificity: computeSpecificity(candidate.profile.trigger),
        }));

      const effective = matches
        .slice()
        .sort((left, right) => right.specificity - left.specificity || left.orderKey.localeCompare(right.orderKey))[0];

      logger?.logComponentAction?.({
        component: "Github_Flows_Execution_Profile_Resolver",
        action: "resolve-effective-profile",
        details: {
          applicableBasis: effective?.profile.trigger ?? null,
          eventAttributes,
          eventId: loggingContext?.eventId,
          matchedCandidates: matches.map((item) => ({
            id: item.id,
            orderKey: item.orderKey,
            specificity: item.specificity,
            trigger: item.profile.trigger,
          })),
          selectedCandidate: effective
            ? {
                id: effective.id,
                orderKey: effective.orderKey,
                specificity: effective.specificity,
              }
            : null,
        },
        message: effective
          ? `Selected effective execution profile ${effective.id}.`
          : "No effective execution profile matched the event.",
      });

      return {
        applicabilityBasis: effective?.profile.trigger ?? null,
        candidates: candidates.map((candidate) => ({
          id: candidate.id,
          orderKey: candidate.orderKey,
          trigger: candidate.profile.trigger,
        })),
        eventAttributes,
        matchedCandidates: matches.map((item) => ({
          id: item.id,
          orderKey: item.orderKey,
          specificity: item.specificity,
          trigger: item.profile.trigger,
        })),
        selectedProfile: effective
          ? {
              id: effective.id,
              execution: effective.profile.execution,
              orderKey: effective.orderKey,
              promptRefBaseDir: effective.profile.promptRefBaseDir,
              type: effective.profile.type,
              trigger: effective.profile.trigger,
            }
          : null,
      };
    };

    /**
     * Backward-compatible helper for callers that still pass the raw GitHub event.
     *
     * @param {{
     *   eventAttributes?: Record<string, unknown>,
     *   headers?: Record<string, string | string[] | undefined>,
     *   loggingContext?: Github_Flows_Event_Logging_Context__Data,
     *   payload?: unknown
     * }} params
     * @returns {Promise<{
     *   applicabilityBasis: Record<string, unknown> | null,
     *   candidates: { id: string, orderKey: string, trigger: Record<string, unknown> }[],
     *   eventAttributes: Record<string, unknown>,
     *   matchedCandidates: { id: string, orderKey: string, specificity: number, trigger: Record<string, unknown> }[],
     *   selectedProfile: Github_Flows_Execution_Profile__Selected | null
     * }>}
     */
    this.resolveByGithubEvent = async function ({ eventAttributes, headers = {}, loggingContext, payload }) {
      const resolvedAttributes = eventAttributes ?? buildEventAttributes({ headers, payload });
      return this.resolveByEventAttributes({ eventAttributes: resolvedAttributes, loggingContext });
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({
    fsPromises: "node:fs/promises",
    logger: "Github_Flows_Logger$",
    pathModule: "node:path",
    runtime: "Github_Flows_Config_Runtime$",
  }),
});

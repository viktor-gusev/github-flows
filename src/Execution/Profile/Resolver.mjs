/**
 * Scans cfg fragments and resolves one effective candidate profile for an event.
 */
const PROFILE_FILENAME = "profile.json";

function asRecord(value) {
  if (value && (typeof value === "object") && !Array.isArray(value)) {
    return /** @type {Record<string, unknown>} */ (value);
  }
  return {};
}

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

function mergeCandidateFragments(fragments) {
  return fragments.reduce((result, fragment) => {
    const trigger = {
      ...result.trigger,
      ...asRecord(fragment.trigger),
    };
    const launch = deepMerge(result.launch, fragment.launch);
    const type = typeof fragment.type === "string" ? fragment.type : result.type;
    return { launch, trigger, type };
  }, { trigger: {}, launch: {}, type: undefined });
}

function normalizeRelativePath(pathValue) {
  return pathValue.length === 0 ? "." : pathValue.split("\\").join("/");
}

function dirnameOf(relativePath) {
  if (relativePath === ".") return ".";
  const normalized = normalizeRelativePath(relativePath);
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash === -1 ? "." : normalized.slice(0, lastSlash);
}

function hasDescendantProfile(fragmentDirectories, candidateDir) {
  const prefix = candidateDir === "." ? "" : `${candidateDir}/`;
  return fragmentDirectories.some((dir) => dir !== candidateDir && dir.startsWith(prefix));
}

function toCandidateId(relativeDir) {
  return normalizeRelativePath(relativeDir === "." ? PROFILE_FILENAME : `${relativeDir}/${PROFILE_FILENAME}`);
}

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

function computeSpecificity(trigger) {
  return Object.values(trigger).filter((value) => value !== undefined).length;
}

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
    const readFragment = async function (absolutePath) {
      const content = await fsPromises.readFile(absolutePath, "utf8");
      const parsed = JSON.parse(content);
      return {
        launch: asRecord(asRecord(parsed).launch),
        type: typeof asRecord(parsed).type === "string" ? asRecord(parsed).type : undefined,
        trigger: asRecord(asRecord(parsed).trigger),
      };
    };

    const scanFragments = async function () {
      const root = pathModule.resolve(runtime.workspaceRoot, "cfg");
      const discovered = new Map();

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

    const buildCandidates = async function () {
      const { fragments } = await scanFragments();
      const fragmentDirectories = Array.from(fragments.keys()).sort();
      const leafDirectories = fragmentDirectories.filter((dir) => !hasDescendantProfile(fragmentDirectories, dir));
      const candidates = [];

      for (const leafDirectory of leafDirectories) {
        const chain = [];
        let cursor = leafDirectory;
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
          id: toCandidateId(leafDirectory),
          orderKey: toCandidateId(leafDirectory),
          fragments: loaded.map((item) => item.directory),
          profile: mergeCandidateFragments(loaded.map((item) => item.fragment)),
        });
      }

      candidates.sort((left, right) => left.orderKey.localeCompare(right.orderKey));
      return candidates;
    };

    /**
     * @param {{
     *   headers?: Record<string, string | string[] | undefined>,
     *   payload: unknown
     * }} params
     */
    this.resolveByGithubEvent = async function ({ headers = {}, payload }) {
      const eventAttributes = buildEventAttributes({ headers, payload });
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
              launch: effective.profile.launch,
              orderKey: effective.orderKey,
              type: effective.profile.type,
              trigger: effective.profile.trigger,
            }
          : null,
      };
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

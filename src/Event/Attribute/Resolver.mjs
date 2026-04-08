/**
 * Resolves the event attribute set used for profile matching, including
 * optional host-provided additional attributes.
 */
// Helper functions for attribute normalization.
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
 * @param {unknown} payload
 * @returns {string | undefined}
 */
function toRepositoryName(payload) {
  const body = asRecord(payload);
  const repository = asRecord(body.repository);
  const repositoryOwner = asRecord(repository.owner);

  if (typeof repository.full_name === "string") {
    return repository.full_name;
  }

  if ((typeof repositoryOwner.login === "string") && (typeof repository.name === "string")) {
    return `${repositoryOwner.login}/${repository.name}`;
  }

  return undefined;
}

/**
 * @param {{
 *   headers: Record<string, string | string[] | undefined>,
 *   payload: unknown
 * }} params
 * @returns {{ action: string | undefined, event: string | undefined, repository: string | undefined }}
 */
function buildBaseAttributes({ headers, payload }) {
  const body = asRecord(payload);

  return {
    action: typeof body.action === "string" ? body.action : undefined,
    event: typeof headers["x-github-event"] === "string" ? headers["x-github-event"] : undefined,
    repository: toRepositoryName(payload),
  };
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainAttributeValue(value) {
  return (
    value === null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
  );
}

/**
 * @param {{ action: string | undefined, event: string | undefined, repository: string | undefined }} baseAttributes
 * @param {unknown} [providedAttributes]
 * @returns {Github_Flows_Event_Attribute__Set}
 */
function normalizeAdditionalAttributes(baseAttributes, providedAttributes = {}) {
  const additionalAttributes = {};

  for (const [key, value] of Object.entries(asRecord(providedAttributes))) {
    if (Object.hasOwn(baseAttributes, key)) continue;
    if (value === undefined) continue;
    if (!isPlainAttributeValue(value)) continue;
    additionalAttributes[key] = value;
  }

  return additionalAttributes;
}

export default class Github_Flows_Event_Attribute_Resolver {
  /**
   * @param {object} deps
   * @param {Github_Flows_Event_Attribute_Provider_Holder} deps.eventAttributeProviderHolder
   * @param {{ logComponentAction?: (entry: {
   *   action: string,
   *   component: string,
   *   details?: unknown,
   *   message: string
   * }) => void }} [deps.logger]
   */
  constructor({ eventAttributeProviderHolder, logger }) {
    /**
     * @param {{
     *   headers?: Record<string, string | string[] | undefined>,
     *   loggingContext?: Github_Flows_Event_Logging_Context__Data,
     *   payload: unknown
     * }} params
     * @returns {Promise<Github_Flows_Event_Attribute_Resolver__Result>}
     */
    this.resolveByGithubEvent = async function ({ headers = {}, loggingContext, payload }) {
      const baseAttributes = buildBaseAttributes({ headers, payload });
      const provider = eventAttributeProviderHolder.get();
      const providerName = provider?.constructor?.name ?? "anonymous";
      const providedAttributes = provider
        ? await provider.getAttributes({
            headers,
            loggingContext,
            payload,
          })
        : undefined;
      const additionalAttributes = normalizeAdditionalAttributes(baseAttributes, providedAttributes);
      const eventAttributes = {
        ...baseAttributes,
        ...additionalAttributes,
      };

      logger?.logComponentAction?.({
        component: "Github_Flows_Event_Attribute_Resolver",
        action: "resolve-event-attributes",
        details: {
          additionalAttributes,
          baseAttributes,
          eventAttributes,
          eventId: loggingContext?.eventId,
          providerUsed: Boolean(provider),
          providerName: provider ? providerName : null,
        },
        message: provider
          ? `Resolved event attributes with host provider ${providerName}.`
          : "Resolved event attributes without host provider.",
      });

      return {
        additionalAttributes,
        baseAttributes,
        eventAttributes,
        providerUsed: Boolean(provider),
      };
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({
    eventAttributeProviderHolder: "Github_Flows_Event_Attribute_Provider_Holder$",
    logger: "Github_Flows_Logger$",
  }),
});

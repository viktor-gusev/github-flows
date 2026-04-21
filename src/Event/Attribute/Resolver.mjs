// @ts-check
/**
 * @namespace Github_Flows_Event_Attribute_Resolver
 * @description Resolves the event attribute set used for profile matching, including optional host-provided additional attributes.
 */
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
   * @param {Github_Flows_Event_Model_Builder} deps.eventModelBuilder
   * @param {Github_Flows_Event_Attribute_Provider_Holder} deps.eventAttributeProviderHolder
   * @param {{ logComponentAction?: (entry: {
   *   action: string,
   *   component: string,
   *   details?: unknown,
   *   message: string
   * }) => void }} [deps.logger]
   */
  constructor({ eventAttributeProviderHolder, eventModelBuilder, logger }) {
    /**
     * @param {{
     *   eventModel?: Github_Flows_Event_Model__Data,
     *   headers?: Record<string, string | string[] | undefined>,
     *   loggingContext?: Github_Flows_Event_Logging_Context__Data,
     *   payload: unknown
     * }} params
     * @returns {Promise<Github_Flows_Event_Attribute_Resolver__Result>}
     */
    this.resolveByGithubEvent = async function ({ eventModel, headers = {}, loggingContext, payload }) {
      const builtModel = eventModel
        ? {
            attributes: Object.fromEntries(
              Object.entries({
                action: eventModel.action,
                actorLogin: eventModel.actorLogin,
                event: eventModel.event,
                repository: eventModel.repository.fullName,
              }).filter(([, value]) => value !== undefined)
            ),
            event: eventModel,
          }
        : eventModelBuilder.buildByGithubEvent({ headers, payload });
      const baseAttributes = builtModel.attributes;
      const provider = eventAttributeProviderHolder.get();
      const providerName = provider?.constructor?.name ?? "anonymous";
      const providedAttributes = provider
        ? await provider.getAttributes({
            eventModel: builtModel.event,
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
          eventModel: builtModel.event,
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
        eventModel: builtModel.event,
        providerUsed: Boolean(provider),
      };
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({
    eventAttributeProviderHolder: "Github_Flows_Event_Attribute_Provider_Holder$",
    eventModelBuilder: "Github_Flows_Event_Model_Builder$",
    logger: "Github_Flows_Logger$",
  }),
});

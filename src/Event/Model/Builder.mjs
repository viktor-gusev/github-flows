// @ts-check
/**
 * @namespace Github_Flows_Event_Model_Builder
 * @description Builds the canonical admitted-event model and base attributes from one admitted GitHub event.
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
 * @param {unknown} payload
 * @returns {{ fullName: string | undefined, name: string | undefined, ownerLogin: string | undefined }}
 */
function toRepositoryIdentity(payload) {
  const body = asRecord(payload);
  const repository = asRecord(body.repository);
  const owner = asRecord(repository.owner);
  const fullName = typeof repository.full_name === "string" ? repository.full_name : undefined;
  const name = typeof repository.name === "string" ? repository.name : undefined;
  const ownerLogin = typeof owner.login === "string" ? owner.login : undefined;

  return {
    fullName: fullName ?? ((ownerLogin && name) ? `${ownerLogin}/${name}` : undefined),
    name,
    ownerLogin,
  };
}

/**
 * @param {{
 *   headers: Record<string, string | string[] | undefined>,
 *   payload: unknown,
 * }} params
 * @returns {Github_Flows_Event_Model__Data}
 */
function buildEventModel({ headers, payload }) {
  const body = asRecord(payload);
  const sender = asRecord(body.sender);
  const repository = toRepositoryIdentity(payload);
  const event = typeof headers["x-github-event"] === "string" ? headers["x-github-event"] : undefined;
  const action = typeof body.action === "string" ? body.action : undefined;
  const actorLogin = typeof sender.login === "string" ? sender.login : undefined;
  const deliveryId = typeof headers["x-github-delivery"] === "string" ? headers["x-github-delivery"] : undefined;

  return {
    action,
    actorLogin,
    deliveryId,
    event,
    repository,
  };
}

/**
 * @param {Github_Flows_Event_Model__Data} eventModel
 * @returns {Record<string, string | undefined>}
 */
function buildBaseAttributes(eventModel) {
  const attributes = {
    action: eventModel.action,
    actorLogin: eventModel.actorLogin,
    event: eventModel.event,
    repository: eventModel.repository.fullName,
  };

  return Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value !== undefined)
  );
}

export default class Github_Flows_Event_Model_Builder {
  constructor() {
    /**
     * @param {{
     *   headers?: Record<string, string | string[] | undefined>,
     *   payload: unknown,
     * }} params
     * @returns {Github_Flows_Event_Model_Builder__Result}
     */
    this.buildByGithubEvent = function ({ headers = {}, payload }) {
      const event = buildEventModel({ headers, payload });
      const attributes = buildBaseAttributes(event);
      return { attributes, event };
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({}),
});

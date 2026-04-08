/**
 * Mutable holder for one optional host-provided event attribute provider.
 */
export default class Github_Flows_Event_Attribute_Provider_Holder {
  constructor() {
    /** @type {Github_Flows_Event_Attribute_Provider | undefined} */
    let provider;

    /**
     * @returns {Github_Flows_Event_Attribute_Provider | undefined}
     */
    this.get = function () {
      return provider;
    };

    /**
     * @param {Github_Flows_Event_Attribute_Provider | undefined} value
     * @returns {void}
     */
    this.set = function (value) {
      if ((value !== undefined) && ((typeof value !== "object") || (typeof value.getAttributes !== "function"))) {
        throw new Error("Event attribute provider must expose getAttributes().");
      }
      provider = value;
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({}),
});

Object.freeze(Github_Flows_Event_Attribute_Provider_Holder.prototype);

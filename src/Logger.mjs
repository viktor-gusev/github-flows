/**
 * Package-level structured logger.
 */
export default class Github_Flows_Logger {
  /**
   * @param {object} [deps]
   * @param {{ info?: (entry: unknown) => void }} [deps.sink]
   */
  constructor({ sink } = {}) {
    const emit = function (entry) {
      if (sink?.info) {
        sink.info(entry);
      } else {
        console.info(JSON.stringify(entry, null, 2));
      }
    };

    /**
     * @param {unknown} entry
     */
    this.info = function (entry) {
      emit(entry);
    };

    /**
     * @param {{
     *   action: string,
     *   component: string,
     *   details?: unknown,
     *   message: string
     * }} entry
     */
    this.logComponentAction = function ({ action, component, details, message }) {
      emit({
        type: "github-flows",
        stage: "component-action",
        component,
        action,
        details,
        message,
      });
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({}),
});

// @ts-check
/**
 * @namespace Github_Flows_Logger
 * @description Package-level structured logger.
 */
export default class Github_Flows_Logger {
  /**
   * @param {{ info?: (entry: unknown) => void } | { sink?: { info?: (entry: unknown) => void } } | undefined} sink
   */
  constructor({ sink }) {
    const actualSink = sink && (typeof sink === "object") && ("info" in sink)
      ? sink
      : sink?.sink;
    const emit = function (entry) {
      if (actualSink?.info) {
        actualSink.info(entry);
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
  default: Object.freeze({
    sink: "Github_Flows_Logger_Sink$",
  }),
});

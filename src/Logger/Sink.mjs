// @ts-check
/**
 * @namespace Github_Flows_Logger_Sink
 * @description Default logger sink that forwards structured logs to console.
 */
export default class Github_Flows_Logger_Sink {
  constructor() {
    this.info = function (entry) {
      console.info(JSON.stringify(entry, null, 2));
    };
  }
}

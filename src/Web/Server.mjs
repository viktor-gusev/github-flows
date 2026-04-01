/**
 * Web server for github-flows.
 */
export default class Github_Flows_Web_Server {
  /**
   * @param {object} deps
   * @param {Fl32_Web_Back_Server} deps.server
   */
  constructor({ server }) {
    this.getInstance = () => server.getInstance();

    this.start = async function () {
      await server.start();
    };

    this.stop = async function () {
      await server.stop();
    };
  }
}

export const __deps__ = Object.freeze({
  server: "Fl32_Web_Back_Server$",
});

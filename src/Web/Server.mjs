/**
 * Web server for github-flows.
 */
export default class Github_Flows_Web_Server {
  /**
   * @param {object} deps
   * @param {Fl32_Web_Back_Server} deps.server
   * @param {Github_Flows_Config_Runtime} deps.config
   */
  constructor({ server, config }) {
    this.getInstance = () => server.getInstance();

    this.start = async function (runtimeCfg = {}) {
      const cfg = {
        port: runtimeCfg.port ?? config.httpPort,
        type: runtimeCfg.type ?? "http",
      };

      if (runtimeCfg.tls !== undefined) {
        cfg.tls = runtimeCfg.tls;
      }

      await server.start(cfg);
    };

    this.stop = async function () {
      await server.stop();
    };
  }
}

export const __deps__ = Object.freeze({
  server: "Fl32_Web_Back_Server$",
  config: "Github_Flows_Config_Runtime$",
});

/**
 * Web server for github-flows.
 */
export default class Github_Flows_Web_Server {
  /**
   * @param {object} deps
   * @param {import("node:http")} deps.http
   * @param {Github_Flows_Config_Runtime} deps.config
   */
  constructor({ http, config }) {
    /** @type {http.Server|undefined} */
    let instance;

    this.getInstance = () => instance;

    this.start = async function () {
      if (instance) {
        return;
      }

      const host = config.httpHost;
      const port = config.httpPort;

      instance = http.createServer((req, res) => {
        if (req.url === "/health") {
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not Found");
      });

      await new Promise((resolve, reject) => {
        instance.once("error", reject);
        instance.listen(port, host, () => {
          instance?.off("error", reject);
          resolve();
        });
      });
    };

    this.stop = async function () {
      if (!instance) {
        return;
      }

      const server = instance;
      instance = undefined;

      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    };
  }
}

export const __deps__ = Object.freeze({
  http: "node:http",
  config: "Github_Flows_Config_Runtime$",
});

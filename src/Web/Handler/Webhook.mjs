/**
 * Static HTTP path for GitHub webhook requests.
 * This is part of the public request contract, not runtime configuration.
 */
const WEBHOOK_PATH = "/webhooks/github";

/**
 * GitHub webhook request handler.
 *
 * Implements `Fl32_Web_Back_Api_Handler` and processes only the static
 * webhook path `/webhooks/github`.
 *
 * @implements {Fl32_Web_Back_Api_Handler}
 */
export default class Github_Flows_Web_Handler_Webhook {
  /**
   * @param {object} deps
   * @param {Github_Flows_Config_Runtime} deps.runtime
   */
  constructor({ runtime }) {
    this.getRegistrationInfo = function () {
      return {
        name: "Github_Flows_Web_Handler_Webhook",
        stage: "PROCESS",
        before: [],
        after: [],
      };
    };

    this.handle = async function (context) {
      const { request, response } = context;
      const secret = runtime.webhookSecret;
      const incomingSecret = request.headers["x-github-webhook-secret"];
      const requestUrl = request.url ?? "/";
      const pathname = new URL(requestUrl, "http://localhost").pathname;

      if (pathname !== WEBHOOK_PATH) {
        return;
      }

      if (incomingSecret !== secret) {
        if (!response.headersSent) {
          response.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
        }
        response.end(JSON.stringify({ error: "unauthorized" }));
        context.complete();
        return;
      }

      if (!response.headersSent) {
        response.writeHead(202, { "Content-Type": "application/json; charset=utf-8" });
      }
      response.end(JSON.stringify({ status: "accepted" }));
      context.complete();
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({
    runtime: "Github_Flows_Config_Runtime$",
  }),
});

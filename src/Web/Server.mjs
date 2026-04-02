/**
 * Host-facing web server component.
 *
 * Registers the GitHub webhook handler with the TeqFW pipeline before the
 * transport server starts listening.
 */
export default class Github_Flows_Web_Server {
  /**
   * @param {object} deps
   * @param {Fl32_Web_Back_PipelineEngine} deps.pipeline
   * @param {Fl32_Web_Back_Server} deps.server
   * @param {Github_Flows_Web_Handler_Webhook} deps.webhookHandler
   */
  constructor({ pipeline, server, webhookHandler }) {
    let handlersRegistered = false;

    const registerHandlers = function () {
      if (handlersRegistered) return;
      pipeline.addHandler(webhookHandler);
      handlersRegistered = true;
    };

    this.getInstance = () => server.getInstance();

    this.start = async function () {
      registerHandlers();
      await server.start();
    };

    this.stop = async function () {
      await server.stop();
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({
    pipeline: "Fl32_Web_Back_PipelineEngine$",
    server: "Fl32_Web_Back_Server$",
    webhookHandler: "Github_Flows_Web_Handler_Webhook$",
  }),
});

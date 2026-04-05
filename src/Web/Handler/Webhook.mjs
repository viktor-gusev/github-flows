/**
 * Static HTTP path for GitHub webhook requests.
 * This is part of the public request contract, not runtime configuration.
 */
const WEBHOOK_PATH = "/webhooks/github";
const SIGNATURE_HEADER = "x-hub-signature-256";

/**
 * Read the raw request body for signature validation.
 *
 * @param {import("node:http").IncomingMessage} request
 * @returns {Promise<Buffer>}
 */
function readRawBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    request.on("error", reject);
  });
}

/**
 * @param {Buffer} body
 * @returns {unknown}
 */
function parseJsonBody(body) {
  return JSON.parse(body.toString("utf8"));
}

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
   * @param {Github_Flows_Web_Handler_Webhook_EventLog} deps.eventLog
   * @param {Github_Flows_Execution_Profile_Resolver} deps.executionProfileResolver
   * @param {Github_Flows_Execution_Start_Coordinator} deps.executionStartCoordinator
   * @param {Github_Flows_Config_Runtime} deps.runtime
   * @param {Github_Flows_Web_Handler_Webhook_Signature} deps.signature
   */
  constructor({ eventLog, executionProfileResolver, executionStartCoordinator, runtime, signature }) {
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
      const signatureHeader = request.headers[SIGNATURE_HEADER];
      const requestUrl = request.url ?? "/";
      const pathname = new URL(requestUrl, "http://localhost").pathname;

      if (pathname !== WEBHOOK_PATH) {
        return;
      }

      const body = await readRawBody(request);
      eventLog.logReception({ body, pathname, request });

      if (!(await signature.isValid({ body, secret, signatureHeader }))) {
        eventLog.logIngress({ outcome: "rejected", reason: "invalid-signature" });
        if (!response.headersSent) {
          response.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
        }
        response.end(JSON.stringify({ error: "unauthorized" }));
        context.complete();
        return;
      }

      let payload;
      try {
        payload = parseJsonBody(body);
      } catch {
        eventLog.logIngress({ outcome: "rejected", reason: "invalid-json" });
        if (!response.headersSent) {
          response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        }
        response.end(JSON.stringify({ error: "invalid-json" }));
        context.complete();
        return;
      }

      try {
        const resolution = await executionProfileResolver.resolveByGithubEvent({
          headers: request.headers,
          payload,
        });
        const selectedProfile = resolution.selectedProfile;

        eventLog.logDecisionTrace({
          resolutionInputs: resolution.eventAttributes,
          decisionBasis: {
            applicabilityBasis: resolution.applicabilityBasis,
            matchedCandidates: resolution.matchedCandidates,
            selectedProfile: selectedProfile
              ? {
                  id: selectedProfile.id,
                  orderKey: selectedProfile.orderKey,
                  trigger: selectedProfile.trigger,
                }
              : null,
          },
          decision: selectedProfile ? "start" : "skip",
        });

        if (selectedProfile) {
          const outcome = await executionStartCoordinator.start({ event: payload, selectedProfile });
          if (!outcome.completed || outcome.exit !== "success") {
            throw new Error(`Execution runtime ended with status: ${outcome.exit}`);
          }
        }
      } catch {
        if (!response.headersSent) {
          response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        }
        response.end(JSON.stringify({ error: "workspace-prepare-failed" }));
        context.complete();
        return;
      }

      eventLog.logIngress({ outcome: "admitted" });
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
    eventLog: "Github_Flows_Web_Handler_Webhook_EventLog$",
    executionProfileResolver: "Github_Flows_Execution_Profile_Resolver$",
    executionStartCoordinator: "Github_Flows_Execution_Start_Coordinator$",
    runtime: "Github_Flows_Config_Runtime$",
    signature: "Github_Flows_Web_Handler_Webhook_Signature$",
  }),
});

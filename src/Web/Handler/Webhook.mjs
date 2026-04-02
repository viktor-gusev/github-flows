import { createHmac, timingSafeEqual } from "node:crypto";

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
 * Validate the GitHub webhook signature.
 *
 * @param {string} secret
 * @param {Buffer} body
 * @param {string | string[] | undefined} signatureHeader
 * @returns {boolean}
 */
function isValidSignature(secret, body, signatureHeader) {
  if (typeof signatureHeader !== "string") {
    return false;
  }

  const [algorithm, digest] = signatureHeader.split("=", 2);
  if (algorithm !== "sha256" || !digest) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const received = Buffer.from(digest, "hex");
  const actual = Buffer.from(expected, "hex");

  return received.length === actual.length && timingSafeEqual(received, actual);
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
      const signatureHeader = request.headers[SIGNATURE_HEADER];
      const requestUrl = request.url ?? "/";
      const pathname = new URL(requestUrl, "http://localhost").pathname;

      if (pathname !== WEBHOOK_PATH) {
        return;
      }

      const body = await readRawBody(request);

      if (!isValidSignature(secret, body, signatureHeader)) {
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

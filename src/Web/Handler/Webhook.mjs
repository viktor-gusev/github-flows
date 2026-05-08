// @ts-check
/**
 * @namespace Github_Flows_Web_Handler_Webhook
 * @description Static HTTP path for GitHub webhook requests. This is part of the public request contract, not runtime configuration.
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
   * @param {Github_Flows_Event_Attribute_Resolver} deps.eventAttributeResolver
   * @param {Github_Flows_Event_Model_Builder} deps.eventModelBuilder
   * @param {Github_Flows_Web_Handler_Webhook_EventLog} deps.eventLog
   * @param {Github_Flows_Event_Logging_Context} deps.eventLoggingContext
   * @param {Github_Flows_Execution_Profile_Resolver} deps.executionProfileResolver
   * @param {Github_Flows_Execution_Start_Coordinator} deps.executionStartCoordinator
   * @param {Github_Flows_Config_Runtime} deps.runtime
   * @param {Github_Flows_Web_Handler_Webhook_Signature} deps.signature
   */
  constructor({ eventAttributeResolver, eventLog, eventLoggingContext, eventModelBuilder, executionProfileResolver, executionStartCoordinator, runtime, signature }) {
    /**
     * @returns {Github_Flows_Web_Handler_Webhook__Info}
     */
    this.getRegistrationInfo = function () {
      return {
        name: "Github_Flows_Web_Handler_Webhook",
        stage: "PROCESS",
        before: [],
        after: [],
      };
    };

    /**
     * @param {Fl32_Web_Back_Dto_RequestContext} context
     * @returns {Promise<void>}
     */
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

      let loggingContext;
      try {
        const admittedEvent = eventModelBuilder.buildByGithubEvent({
          headers: request.headers,
          payload,
        });
        loggingContext = eventLoggingContext.createByEventModel(admittedEvent.event);
        await eventLog.persistEventSnapshot({
          headers: request.headers,
          loggingContext,
          payload,
        });
        await eventLog.logEventProcessing({
          action: "admitted-event-snapshot",
          component: "Github_Flows_Web_Handler_Webhook",
          details: {
            eventId: loggingContext.eventId,
            eventType: loggingContext.eventType,
            logDirectory: loggingContext.logDirectory,
            owner: loggingContext.owner,
            repo: loggingContext.repo,
          },
          loggingContext,
          message: `Initialized event-scoped archival logging for ${loggingContext.owner}/${loggingContext.repo}.`,
          stage: "admission",
        });

        const attributeResolution = await eventAttributeResolver.resolveByGithubEvent({
          eventModel: admittedEvent.event,
          loggingContext,
          payload,
        });
        await eventLog.logEventProcessing({
          action: "resolve-event-attributes",
          component: "Github_Flows_Event_Attribute_Resolver",
          details: {
            additionalAttributes: attributeResolution.additionalAttributes,
            baseAttributes: attributeResolution.baseAttributes,
            eventAttributes: attributeResolution.eventAttributes,
            providerUsed: attributeResolution.providerUsed,
          },
          loggingContext,
          message: attributeResolution.providerUsed
            ? `Resolved additional event attributes for admitted event ${loggingContext.eventId}.`
            : `Resolved base event attributes for admitted event ${loggingContext.eventId}.`,
          stage: "attribute-enrichment",
        });

        const resolution = await executionProfileResolver.resolveByEventAttributes({
          eventAttributes: attributeResolution.eventAttributes,
          loggingContext,
        });
        const selectedProfile = resolution.selectedProfile;

        await eventLog.logDecisionTrace({
          loggingContext,
          resolutionInputs: attributeResolution.eventAttributes,
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
          await eventLog.persistEffectiveProfile({ loggingContext, selectedProfile });
          const outcome = await executionStartCoordinator.start({ event: payload, loggingContext, selectedProfile });
          if (!outcome.completed || outcome.exit !== "success") {
            throw new Error(`Execution runtime ended with status: ${outcome.exit}`);
          }
        } else {
          await eventLog.logEventProcessing({
            action: "execution-skip",
            component: "Github_Flows_Web_Handler_Webhook",
            details: {
              eventId: loggingContext.eventId,
              selectedProfile: null,
            },
            loggingContext,
            message: `Skipped execution for admitted event ${loggingContext.eventId}.`,
            stage: "execution-decision",
          });
        }
      } catch (error) {
        await eventLog.logEventProcessing({
          action: "execution-failed",
          component: "Github_Flows_Web_Handler_Webhook",
          details: {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          loggingContext,
          message: `Execution failed for admitted event ${loggingContext.eventId}.`,
          stage: "execution-runtime",
        });
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
    eventAttributeResolver: "Github_Flows_Event_Attribute_Resolver$",
    eventLog: "Github_Flows_Web_Handler_Webhook_EventLog$",
    eventLoggingContext: "Github_Flows_Event_Logging_Context$",
    eventModelBuilder: "Github_Flows_Event_Model_Builder$",
    executionProfileResolver: "Github_Flows_Execution_Profile_Resolver$",
    executionStartCoordinator: "Github_Flows_Execution_Start_Coordinator$",
    runtime: "Github_Flows_Config_Runtime$",
    signature: "Github_Flows_Web_Handler_Webhook_Signature$",
  }),
});

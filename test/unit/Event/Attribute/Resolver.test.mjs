import assert from "node:assert/strict";
import test from "node:test";

import Github_Flows_Event_Attribute_Resolver from "../../../../src/Event/Attribute/Resolver.mjs";

test("event attribute resolver returns model-derived base attributes when no provider is configured", async () => {
  const resolver = new Github_Flows_Event_Attribute_Resolver({
    eventModelBuilder: {
      buildByGithubEvent(entry) {
        assert.deepEqual(entry, {
          headers: { "x-github-event": "issue_comment" },
          payload: {
            action: "created",
            repository: {
              name: "demo",
              owner: { login: "octocat" },
            },
            sender: { login: "flancer32" },
          },
        });
        return {
          attributes: {
            action: "created",
            actorLogin: "flancer32",
            event: "issue_comment",
            repository: "octocat/demo",
          },
          event: {
            action: "created",
            actorLogin: "flancer32",
            deliveryId: undefined,
            event: "issue_comment",
            repository: {
              fullName: "octocat/demo",
              name: "demo",
              ownerLogin: "octocat",
            },
          },
        };
      },
    },
    eventAttributeProviderHolder: {
      get() {
        return undefined;
      },
    },
  });

  const result = await resolver.resolveByGithubEvent({
    headers: { "x-github-event": "issue_comment" },
    payload: {
      action: "created",
      repository: {
        name: "demo",
        owner: { login: "octocat" },
      },
      sender: { login: "flancer32" },
    },
  });

  assert.deepEqual(result, {
    additionalAttributes: {},
    baseAttributes: {
      action: "created",
      actorLogin: "flancer32",
      event: "issue_comment",
      repository: "octocat/demo",
    },
    eventModel: {
      action: "created",
      actorLogin: "flancer32",
      deliveryId: undefined,
      event: "issue_comment",
      repository: {
        fullName: "octocat/demo",
        name: "demo",
        ownerLogin: "octocat",
      },
    },
    eventAttributes: {
      action: "created",
      actorLogin: "flancer32",
      event: "issue_comment",
      repository: "octocat/demo",
    },
    providerUsed: false,
  });
});

test("event attribute resolver merges only additional plain attributes from the provider", async () => {
  const calls = [];
  const resolver = new Github_Flows_Event_Attribute_Resolver({
    eventModelBuilder: {
      buildByGithubEvent({ headers, payload }) {
        assert.deepEqual(headers, { "x-github-event": "issue_comment" });
        assert.deepEqual(payload, {
          action: "created",
          repository: {
            full_name: "octocat/demo",
          },
          sender: {
            login: "octocat",
          },
        });
        return {
          attributes: {
            action: "created",
            actorLogin: "octocat",
            event: "issue_comment",
            repository: "octocat/demo",
          },
          event: {
            action: "created",
            actorLogin: "octocat",
            deliveryId: undefined,
            event: "issue_comment",
            repository: {
              fullName: "octocat/demo",
              name: "demo",
              ownerLogin: "octocat",
            },
          },
        };
      },
    },
    eventAttributeProviderHolder: {
      get() {
        return {
          async getAttributes(entry) {
            calls.push(entry);
            return {
              action: "ignored-conflict",
              actorLogin: "ignored-conflict",
              author: "octocat",
              commentBodyLength: 128,
              nested: { denied: true },
              skip: undefined,
            };
          },
        };
      },
    },
  });

  const loggingContext = { eventId: "delivery-123" };
  const payload = {
    action: "created",
    repository: {
      full_name: "octocat/demo",
    },
    sender: {
      login: "octocat",
    },
  };

  const result = await resolver.resolveByGithubEvent({
    headers: { "x-github-event": "issue_comment" },
    loggingContext,
    payload,
  });

  assert.deepEqual(calls, [{
    eventModel: {
      action: "created",
      actorLogin: "octocat",
      deliveryId: undefined,
      event: "issue_comment",
      repository: {
        fullName: "octocat/demo",
        name: "demo",
        ownerLogin: "octocat",
      },
    },
    headers: { "x-github-event": "issue_comment" },
    loggingContext,
    payload,
  }]);
  assert.deepEqual(result, {
    additionalAttributes: {
      author: "octocat",
      commentBodyLength: 128,
    },
    baseAttributes: {
      action: "created",
      actorLogin: "octocat",
      event: "issue_comment",
      repository: "octocat/demo",
    },
    eventModel: {
      action: "created",
      actorLogin: "octocat",
      deliveryId: undefined,
      event: "issue_comment",
      repository: {
        fullName: "octocat/demo",
        name: "demo",
        ownerLogin: "octocat",
      },
    },
    eventAttributes: {
      action: "created",
      actorLogin: "octocat",
      author: "octocat",
      commentBodyLength: 128,
      event: "issue_comment",
      repository: "octocat/demo",
    },
    providerUsed: true,
  });
});

test("event attribute resolver passes both eventModel and raw payload to the host provider", async () => {
  const calls = [];
  const resolver = new Github_Flows_Event_Attribute_Resolver({
    eventModelBuilder: {
      buildByGithubEvent() {
        return {
          attributes: {
            action: "opened",
            actorLogin: "flancer64",
            event: "issues",
            repository: "octocat/demo",
          },
          event: {
            action: "opened",
            actorLogin: "flancer64",
            deliveryId: "delivery-123",
            event: "issues",
            repository: {
              fullName: "octocat/demo",
              name: "demo",
              ownerLogin: "octocat",
            },
          },
        };
      },
    },
    eventAttributeProviderHolder: {
      get() {
        return {
          async getAttributes(entry) {
            calls.push(entry);
            const issue = /** @type {Record<string, unknown>} */ (/** @type {Record<string, unknown>} */ (entry.payload).issue ?? {});
            const user = /** @type {Record<string, unknown>} */ (issue.user ?? {});
            return {
              actorScope: entry.eventModel.actorLogin,
              issueAuthorLogin: typeof user.login === "string" ? user.login : undefined,
            };
          },
        };
      },
    },
  });

  const payload = {
    action: "opened",
    issue: {
      user: {
        login: "flancer32",
      },
    },
    repository: {
      full_name: "octocat/demo",
    },
    sender: {
      login: "flancer64",
    },
  };

  const result = await resolver.resolveByGithubEvent({
    headers: { "x-github-delivery": "delivery-123", "x-github-event": "issues" },
    loggingContext: { eventId: "delivery-123" },
    payload,
  });

  assert.deepEqual(calls, [{
    eventModel: {
      action: "opened",
      actorLogin: "flancer64",
      deliveryId: "delivery-123",
      event: "issues",
      repository: {
        fullName: "octocat/demo",
        name: "demo",
        ownerLogin: "octocat",
      },
    },
    headers: { "x-github-delivery": "delivery-123", "x-github-event": "issues" },
    loggingContext: { eventId: "delivery-123" },
    payload,
  }]);
  assert.deepEqual(result.additionalAttributes, {
    actorScope: "flancer64",
    issueAuthorLogin: "flancer32",
  });
});

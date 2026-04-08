import assert from "node:assert/strict";
import test from "node:test";

import Github_Flows_Event_Attribute_Resolver from "../../../../src/Event/Attribute/Resolver.mjs";

test("event attribute resolver returns base attributes when no provider is configured", async () => {
  const resolver = new Github_Flows_Event_Attribute_Resolver({
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
    },
  });

  assert.deepEqual(result, {
    additionalAttributes: {},
    baseAttributes: {
      action: "created",
      event: "issue_comment",
      repository: "octocat/demo",
    },
    eventAttributes: {
      action: "created",
      event: "issue_comment",
      repository: "octocat/demo",
    },
    providerUsed: false,
  });
});

test("event attribute resolver merges only additional plain attributes from the provider", async () => {
  const calls = [];
  const resolver = new Github_Flows_Event_Attribute_Resolver({
    eventAttributeProviderHolder: {
      get() {
        return {
          async getAttributes(entry) {
            calls.push(entry);
            return {
              action: "ignored-conflict",
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
  };

  const result = await resolver.resolveByGithubEvent({
    headers: { "x-github-event": "issue_comment" },
    loggingContext,
    payload,
  });

  assert.deepEqual(calls, [{
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
      event: "issue_comment",
      repository: "octocat/demo",
    },
    eventAttributes: {
      action: "created",
      author: "octocat",
      commentBodyLength: 128,
      event: "issue_comment",
      repository: "octocat/demo",
    },
    providerUsed: true,
  });
});

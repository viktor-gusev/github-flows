import assert from "node:assert/strict";
import test from "node:test";

import Github_Flows_Event_Model_Builder from "../../../../src/Event/Model/Builder.mjs";

test("event model builder derives canonical admitted-event model and base attributes", () => {
  const builder = new Github_Flows_Event_Model_Builder();

  const result = builder.buildByGithubEvent({
    headers: {
      "x-github-delivery": "delivery-123",
      "x-github-event": "issues",
    },
    payload: {
      action: "opened",
      repository: {
        full_name: "octocat/demo",
        name: "demo",
        owner: { login: "octocat" },
      },
      sender: {
        login: "flancer64",
      },
    },
  });

  assert.deepEqual(result, {
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
  });
});

test("event model builder omits optional actorLogin when sender login is absent", () => {
  const builder = new Github_Flows_Event_Model_Builder();

  const result = builder.buildByGithubEvent({
    headers: {
      "x-github-event": "pull_request_review",
    },
    payload: {
      action: "submitted",
      repository: {
        name: "demo",
        owner: { login: "octocat" },
      },
    },
  });

  assert.deepEqual(result.attributes, {
    action: "submitted",
    event: "pull_request_review",
    repository: "octocat/demo",
  });
  assert.equal(result.event.actorLogin, undefined);
});

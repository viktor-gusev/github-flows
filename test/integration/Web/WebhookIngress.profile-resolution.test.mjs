import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  createIssueOpenedPayload,
  createLogger,
  createProductHarness,
  createWorkspace,
  getEventLogDir,
  handleWebhookEvent,
  installFakeDocker,
  installFakeGh,
  installFakeGit,
  readJson,
  readOptionalJson,
  readOptionalText,
  writeProfile,
  writePrompt,
} from "./_helpers.mjs";

function assertAccepted(responseCalls) {
  assert.deepEqual(responseCalls, [
    { method: "writeHead", code: 202, headers: { "Content-Type": "application/json; charset=utf-8" } },
    { method: "end", body: JSON.stringify({ status: "accepted" }) },
    { method: "complete" },
  ]);
}

async function readEventLogEntries(logDirectory) {
  const logPath = path.join(logDirectory, "events.log");
  const content = await readOptionalText(logPath);
  if (content === null) return [];
  return content
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

async function withWebhookScenario({ eventAttributeProvider, run }) {
  const workspaceRoot = await createWorkspace();
  const fakeStateDir = path.join(workspaceRoot, "fake-bin-state");
  const fakeGhDir = await installFakeGh(workspaceRoot);
  const fakeGitDir = await installFakeGit(workspaceRoot);
  const fakeDockerDir = await installFakeDocker(workspaceRoot);
  const originalPath = process.env.PATH;
  const originalStateDir = process.env.FAKE_BIN_STATE_DIR;
  const loggerCalls = [];
  const logger = createLogger(loggerCalls);

  process.env.PATH = `${fakeDockerDir}:${fakeGitDir}:${fakeGhDir}:${originalPath ?? ""}`;
  process.env.FAKE_BIN_STATE_DIR = fakeStateDir;

  try {
    await run({
      createHandler: async () => {
        const { handler } = await createProductHarness({
          eventAttributeProvider,
          logger,
          workspaceRoot,
        });
        return handler;
      },
      fakeStateDir,
      loggerCalls,
      workspaceRoot,
    });
  } finally {
    process.env.PATH = originalPath;
    process.env.FAKE_BIN_STATE_DIR = originalStateDir;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

test("webhook ingress preserves scalar trigger behavior and persists key execution artifacts", { concurrency: false, timeout: 5000 }, async () => {
  await withWebhookScenario({
    async run({ createHandler, fakeStateDir, workspaceRoot }) {
      await writeProfile(workspaceRoot, "issues", {
        trigger: {
          event: "issues",
          repository: "octocat/demo",
          action: "opened",
          actorLogin: "flancer64",
        },
        execution: {
          handler: {
            type: "agent",
            command: ["node"],
            args: [],
            promptRef: "default.md",
            promptVariables: {
              required: {
                ISSUE_TITLE: "event.issue.title",
                ACTOR: "host.actor",
              },
            },
          },
          runtime: {
            dockerArgs: ["--env", "FEATURE_FLAG=scalar"],
            image: "profile-image",
            setupScript: "true",
            env: {
              EXECUTION_MODE: "integration",
            },
            timeoutSec: 30,
          },
        },
      });
      await writePrompt(workspaceRoot, path.join("issues", "default.md"), "Issue {{ISSUE_TITLE}} by {{ACTOR}}");

      const handler = await createHandler();
      const deliveryId = "evt-scalar-1";
      const responseCalls = await handleWebhookEvent({
        deliveryId,
        handler,
        payload: createIssueOpenedPayload({
          issueTitle: "Scalar issue",
          senderLogin: "flancer64",
        }),
      });
      assertAccepted(responseCalls);

      const workspacePath = path.join(workspaceRoot, "ws", "octocat", "demo", "issues", deliveryId);
      await assert.doesNotReject(fs.stat(path.join(workspacePath, "repo", ".git")));
      await assert.doesNotReject(fs.stat(path.join(workspaceRoot, "cache", "repo", "octocat", "demo", ".git")));

      const logDirectory = getEventLogDir(workspaceRoot, { deliveryId });
      const eventSnapshot = await readJson(path.join(logDirectory, "event.json"));
      assert.equal(eventSnapshot.body.issue.title, "Scalar issue");
      assert.equal(eventSnapshot.body.sender.login, "flancer64");

      const effectiveProfile = await readJson(path.join(logDirectory, "effective-profile.json"));
      assert.deepEqual(effectiveProfile.trigger, {
        action: "opened",
        actorLogin: "flancer64",
        event: "issues",
        repository: "octocat/demo",
      });
      assert.equal(effectiveProfile.execution.runtime.image, "profile-image");

      const promptBindings = await readJson(path.join(logDirectory, "prompt-bindings.json"));
      assert.deepEqual(promptBindings, {
        ACTOR: "flancer64",
        ISSUE_TITLE: "Scalar issue",
      });

      const commandsLog = await readOptionalText(path.join(fakeStateDir, "commands.log"));
      assert.ok(commandsLog?.includes("gh repo clone octocat/demo"), "Expected repository cache clone command.");
      assert.ok(commandsLog?.includes("git clone --no-hardlinks"), "Expected workspace clone command.");
      assert.ok(commandsLog?.includes("remote get-url origin"), "Expected cache origin inspection command.");
      assert.ok(commandsLog?.includes("remote set-url origin git@github.com:octocat/demo.git"), "Expected workspace origin rewrite command.");
      assert.ok(commandsLog?.includes(`type=bind,src=${workspacePath},dst=/workspace`), "Expected Docker workspace mount.");
      assert.ok(commandsLog?.includes("docker run --rm --init"), "Expected Docker runtime launch.");
      assert.ok(commandsLog?.includes("profile-image"), "Expected selected runtime image in Docker command.");
      assert.ok(commandsLog?.includes("Issue Scalar issue by flancer64"), "Expected materialized prompt content in Docker command.");

      const eventEntries = await readEventLogEntries(logDirectory);
      assert.ok(eventEntries.some((entry) => entry.action === "prompt-materialize"), "Expected prompt materialization entry.");
      assert.ok(eventEntries.some((entry) => entry.action === "docker-run-complete"), "Expected Docker completion entry.");
    },
    eventAttributeProvider: {
      async getAttributes({ eventModel }) {
        return {
          actor: eventModel.actorLogin,
        };
      },
    },
  });
});

test("webhook ingress expands actorLogin trigger arrays through the real execution flow", { concurrency: false, timeout: 5000 }, async () => {
  await withWebhookScenario({
    async run({ createHandler, fakeStateDir, workspaceRoot }) {
      await writeProfile(workspaceRoot, "issues", {
        trigger: {
          event: "issues",
          repository: "octocat/demo",
          action: "opened",
          actorLogin: ["flancer64", "flancer32"],
        },
        execution: {
          handler: {
            type: "agent",
            command: ["node"],
            args: [],
            promptRef: "default.md",
            promptVariables: {
              required: {
                ACTOR: "event.sender.login",
              },
            },
          },
          runtime: {
            dockerArgs: [],
            image: "actor-array-image",
            setupScript: "true",
            env: {},
            timeoutSec: 30,
          },
        },
      });
      await writePrompt(workspaceRoot, path.join("issues", "default.md"), "Actor {{ACTOR}}");

      const handler = await createHandler();
      for (const deliveryId of ["evt-actor-64", "evt-actor-32"]) {
        const senderLogin = deliveryId.endsWith("64") ? "flancer64" : "flancer32";
        const responseCalls = await handleWebhookEvent({
          deliveryId,
          handler,
          payload: createIssueOpenedPayload({ senderLogin }),
        });
        assertAccepted(responseCalls);

        const effectiveProfile = await readJson(path.join(
          getEventLogDir(workspaceRoot, { deliveryId }),
          "effective-profile.json",
        ));
        assert.equal(effectiveProfile.trigger.actorLogin, senderLogin);
        assert.ok(!Array.isArray(effectiveProfile.trigger.actorLogin), "Expected persisted effective trigger to stay scalar.");
      }

      const commandsBeforeNoMatch = await readOptionalText(path.join(fakeStateDir, "commands.log"));
      const responseCalls = await handleWebhookEvent({
        deliveryId: "evt-actor-other",
        handler,
        payload: createIssueOpenedPayload({ senderLogin: "someone-else" }),
      });
      assertAccepted(responseCalls);

      const noMatchLogDirectory = getEventLogDir(workspaceRoot, { deliveryId: "evt-actor-other" });
      assert.equal(await readOptionalJson(path.join(noMatchLogDirectory, "effective-profile.json")), null);
      await assert.rejects(fs.stat(path.join(workspaceRoot, "ws", "octocat", "demo", "issues", "evt-actor-other")));
      assert.equal(await readOptionalText(path.join(fakeStateDir, "commands.log")), commandsBeforeNoMatch);

      const noMatchEntries = await readEventLogEntries(noMatchLogDirectory);
      assert.ok(noMatchEntries.some((entry) => entry.decision === "skip"), "Expected decision trace to record a skip.");
      assert.ok(noMatchEntries.some((entry) => entry.action === "execution-skip"), "Expected execution skip entry.");
    },
  });
});

test("webhook ingress matches host-provided trigger arrays and reuses the matched attribute for prompt bindings", { concurrency: false, timeout: 5000 }, async () => {
  await withWebhookScenario({
    async run({ createHandler, fakeStateDir, workspaceRoot }) {
      await writeProfile(workspaceRoot, "issues", {
        trigger: {
          event: "issues",
          repository: "octocat/demo",
          action: "opened",
          reviewLane: ["priority", "expedite"],
        },
        execution: {
          handler: {
            type: "agent",
            command: ["node"],
            args: [],
            promptRef: "default.md",
            promptVariables: {
              required: {
                ISSUE_TITLE: "event.issue.title",
              },
              optional: {
                REVIEW_LANE: {
                  path: "host.reviewLane",
                },
              },
            },
          },
          runtime: {
            dockerArgs: [],
            image: "host-array-image",
            setupScript: "true",
            env: {},
            timeoutSec: 30,
          },
        },
      });
      await writePrompt(workspaceRoot, path.join("issues", "default.md"), "Issue {{ISSUE_TITLE}} lane {{REVIEW_LANE}}");

      const handler = await createHandler();
      const acceptedResponse = await handleWebhookEvent({
        deliveryId: "evt-lane-priority",
        handler,
        payload: createIssueOpenedPayload({
          issueNumber: 42,
          issueTitle: "Priority lane issue",
        }),
      });
      assertAccepted(acceptedResponse);

      const promptBindings = await readJson(path.join(
        getEventLogDir(workspaceRoot, { deliveryId: "evt-lane-priority" }),
        "prompt-bindings.json",
      ));
      assert.deepEqual(promptBindings, {
        ISSUE_TITLE: "Priority lane issue",
        REVIEW_LANE: "priority",
      });

      const effectiveProfile = await readJson(path.join(
        getEventLogDir(workspaceRoot, { deliveryId: "evt-lane-priority" }),
        "effective-profile.json",
      ));
      assert.equal(effectiveProfile.trigger.reviewLane, "priority");

      const commandsBeforeNoMatch = await readOptionalText(path.join(fakeStateDir, "commands.log"));
      const skippedResponse = await handleWebhookEvent({
        deliveryId: "evt-lane-backlog",
        handler,
        payload: createIssueOpenedPayload({
          issueNumber: 7,
          issueTitle: "Backlog lane issue",
        }),
      });
      assertAccepted(skippedResponse);

      const skippedLogDirectory = getEventLogDir(workspaceRoot, { deliveryId: "evt-lane-backlog" });
      assert.equal(await readOptionalJson(path.join(skippedLogDirectory, "effective-profile.json")), null);
      assert.equal(await readOptionalText(path.join(fakeStateDir, "commands.log")), commandsBeforeNoMatch);
    },
    eventAttributeProvider: {
      async getAttributes({ payload }) {
        return {
          reviewLane: payload.issue.number === 42 ? "priority" : "backlog",
        };
      },
    },
  });
});

test("webhook ingress expands multiple trigger arrays after hierarchical merge and persists the merged scalar winner", { concurrency: false, timeout: 5000 }, async () => {
  await withWebhookScenario({
    async run({ createHandler, workspaceRoot }) {
      await writeProfile(workspaceRoot, ".", {
        trigger: {
          event: "issues",
          repository: "octocat/demo",
        },
        execution: {
          handler: {
            type: "agent",
            command: ["node"],
            args: [],
          },
          runtime: {
            dockerArgs: [],
            image: "root-image",
            setupScript: "true",
            env: {
              ROOT_ENV: "1",
            },
            timeoutSec: 30,
          },
        },
      });
      await writeProfile(workspaceRoot, "issues", {
        trigger: {
          actorLogin: ["flancer64", "flancer32"],
        },
        execution: {
          handler: {
            promptVariables: {
              required: {
                ACTOR: "event.sender.login",
              },
            },
          },
          runtime: {
            env: {
              MIDDLE_ENV: "1",
            },
          },
        },
      });
      await writeProfile(workspaceRoot, path.join("issues", "opened"), {
        trigger: {
          action: "opened",
          reviewLane: ["priority", "expedite"],
        },
        execution: {
          handler: {
            promptRef: "default.md",
            promptVariables: {
              optional: {
                REVIEW_LANE: {
                  path: "host.reviewLane",
                },
              },
            },
          },
          runtime: {
            image: "leaf-image",
            env: {
              LEAF_ENV: "1",
            },
          },
        },
      });
      await writePrompt(workspaceRoot, path.join("issues", "opened", "default.md"), "Actor {{ACTOR}} lane {{REVIEW_LANE}}");

      const handler = await createHandler();
      for (const [deliveryId, senderLogin, issueNumber, expectedLane] of [
        ["evt-merged-1", "flancer64", 1, "priority"],
        ["evt-merged-2", "flancer32", 2, "expedite"],
      ]) {
        const responseCalls = await handleWebhookEvent({
          deliveryId,
          handler,
          payload: createIssueOpenedPayload({ issueNumber, senderLogin }),
        });
        assertAccepted(responseCalls);

        const effectiveProfile = await readJson(path.join(
          getEventLogDir(workspaceRoot, { deliveryId }),
          "effective-profile.json",
        ));
        assert.deepEqual(effectiveProfile.trigger, {
          action: "opened",
          actorLogin: senderLogin,
          event: "issues",
          repository: "octocat/demo",
          reviewLane: expectedLane,
        });
        assert.equal(effectiveProfile.promptRefBaseDir, "issues/opened");
        assert.deepEqual(effectiveProfile.execution.runtime.env, {
          ROOT_ENV: "1",
          MIDDLE_ENV: "1",
          LEAF_ENV: "1",
        });
        assert.equal(effectiveProfile.execution.runtime.image, "leaf-image");
      }

    },
    eventAttributeProvider: {
      async getAttributes({ payload }) {
        const lanes = new Map([
          [1, "priority"],
          [2, "expedite"],
        ]);
        return {
          reviewLane: lanes.get(payload.issue.number) ?? "backlog",
        };
      },
    },
  });
});

test("webhook ingress treats empty trigger arrays as no candidate profiles without starting execution", { concurrency: false, timeout: 5000 }, async () => {
  await withWebhookScenario({
    async run({ createHandler, fakeStateDir, workspaceRoot }) {
      await writeProfile(workspaceRoot, "issues", {
        trigger: {
          event: "issues",
          repository: "octocat/demo",
          action: "opened",
          actorLogin: [],
        },
        execution: {
          handler: {
            type: "agent",
            command: ["node"],
            args: [],
            promptRef: "default.md",
          },
          runtime: {
            dockerArgs: [],
            image: "empty-array-image",
            setupScript: "true",
            env: {},
            timeoutSec: 30,
          },
        },
      });
      await writePrompt(workspaceRoot, path.join("issues", "default.md"), "Should not run");

      const handler = await createHandler();
      const deliveryId = "evt-empty-array";
      const responseCalls = await handleWebhookEvent({
        deliveryId,
        handler,
        payload: createIssueOpenedPayload({ senderLogin: "flancer64" }),
      });
      assertAccepted(responseCalls);

      const logDirectory = getEventLogDir(workspaceRoot, { deliveryId });
      assert.equal(await readOptionalJson(path.join(logDirectory, "effective-profile.json")), null);
      assert.equal(await readOptionalText(path.join(logDirectory, "prompt-bindings.json")), null);
      await assert.rejects(fs.stat(path.join(workspaceRoot, "cache", "repo", "octocat", "demo", ".git")));
      await assert.rejects(fs.stat(path.join(workspaceRoot, "ws", "octocat", "demo", "issues", deliveryId)));
      assert.equal(await readOptionalText(path.join(fakeStateDir, "commands.log")), null);

      const eventEntries = await readEventLogEntries(logDirectory);
      assert.ok(eventEntries.some((entry) => entry.decision === "skip"), "Expected skip decision for empty-array trigger.");
      assert.ok(eventEntries.every((entry) => entry.action !== "workspace-prepare-start"), "Did not expect workspace preparation for empty-array trigger.");
    },
  });
});

test("webhook ingress skips valid no-match events without preparing a workspace or starting Docker", { concurrency: false, timeout: 5000 }, async () => {
  await withWebhookScenario({
    async run({ createHandler, fakeStateDir, workspaceRoot }) {
      await writeProfile(workspaceRoot, "issues", {
        trigger: {
          event: "issues",
          repository: "octocat/demo",
          action: "opened",
          actorLogin: "flancer64",
        },
        execution: {
          handler: {
            type: "agent",
            command: ["node"],
            args: [],
            promptRef: "default.md",
          },
          runtime: {
            dockerArgs: [],
            image: "no-match-image",
            setupScript: "true",
            env: {},
            timeoutSec: 30,
          },
        },
      });
      await writePrompt(workspaceRoot, path.join("issues", "default.md"), "No match");

      const handler = await createHandler();
      const deliveryId = "evt-no-match";
      const responseCalls = await handleWebhookEvent({
        deliveryId,
        handler,
        payload: createIssueOpenedPayload({ senderLogin: "another-user" }),
      });
      assertAccepted(responseCalls);

      const logDirectory = getEventLogDir(workspaceRoot, { deliveryId });
      assert.equal(await readOptionalJson(path.join(logDirectory, "effective-profile.json")), null);
      assert.equal(await readOptionalText(path.join(logDirectory, "prompt-bindings.json")), null);
      await assert.doesNotReject(fs.stat(path.join(logDirectory, "event.json")));
      await assert.rejects(fs.stat(path.join(workspaceRoot, "ws", "octocat", "demo", "issues", deliveryId)));
      await assert.rejects(fs.stat(path.join(workspaceRoot, "cache", "repo", "octocat", "demo", ".git")));
      assert.equal(await readOptionalText(path.join(fakeStateDir, "commands.log")), null);

      const eventEntries = await readEventLogEntries(logDirectory);
      assert.ok(eventEntries.some((entry) => entry.decision === "skip"), "Expected skip decision for unmatched event.");
      assert.ok(eventEntries.some((entry) => entry.action === "execution-skip"), "Expected execution skip event.");
      assert.ok(eventEntries.every((entry) => entry.action !== "docker-run-start"), "Did not expect Docker startup for unmatched event.");
    },
  });
});

test("webhook ingress preserves documented deterministic precedence when expanded and scalar candidates both match", { concurrency: false, timeout: 5000 }, async () => {
  await withWebhookScenario({
    async run({ createHandler, fakeStateDir, workspaceRoot }) {
      await writeProfile(workspaceRoot, "a", {
        trigger: {
          event: "issues",
          repository: "octocat/demo",
          actorLogin: ["flancer64", "flancer32"],
        },
        execution: {
          handler: {
            type: "agent",
            command: ["node"],
            args: [],
            promptRef: "a.md",
          },
          runtime: {
            dockerArgs: [],
            image: "array-precedence-image",
            setupScript: "true",
            env: {},
            timeoutSec: 30,
          },
        },
      });
      await writeProfile(workspaceRoot, "b", {
        trigger: {
          event: "issues",
          repository: "octocat/demo",
          actorLogin: "flancer32",
        },
        execution: {
          handler: {
            type: "agent",
            command: ["node"],
            args: [],
            promptRef: "b.md",
          },
          runtime: {
            dockerArgs: [],
            image: "scalar-precedence-image",
            setupScript: "true",
            env: {},
            timeoutSec: 30,
          },
        },
      });
      await writePrompt(workspaceRoot, path.join("a", "a.md"), "Array precedence");
      await writePrompt(workspaceRoot, path.join("b", "b.md"), "Scalar precedence");

      const handler = await createHandler();
      const deliveryId = "evt-precedence";
      const responseCalls = await handleWebhookEvent({
        deliveryId,
        handler,
        payload: createIssueOpenedPayload({ senderLogin: "flancer32" }),
      });
      assertAccepted(responseCalls);

      const effectiveProfile = await readJson(path.join(
        getEventLogDir(workspaceRoot, { deliveryId }),
        "effective-profile.json",
      ));
      assert.equal(effectiveProfile.id, "a/profile.json");
      assert.equal(effectiveProfile.execution.runtime.image, "array-precedence-image");

      const commandsLog = await readOptionalText(path.join(fakeStateDir, "commands.log"));
      assert.ok(commandsLog?.includes("array-precedence-image"), "Expected winning image from lexicographically earlier candidate.");
      assert.ok(!commandsLog?.includes("scalar-precedence-image"), "Did not expect losing candidate image in Docker command.");
    },
  });
});

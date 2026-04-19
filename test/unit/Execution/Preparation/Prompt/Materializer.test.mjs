import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import Github_Flows_Execution_Preparation_Prompt_Materializer from "../../../../../src/Execution/Preparation/Prompt/Materializer.mjs";

function createSelectedProfile(handler = {}) {
  return {
    id: "issues/profile.json",
    orderKey: "issues/profile.json",
    promptRefBaseDir: "issues",
    trigger: { event: "issues" },
    type: "docker",
    execution: {
      handler: {
        type: "codex",
        command: ["node"],
        args: [],
        promptRef: "default.md",
        ...handler,
      },
      runtime: {
        image: "codex-agent",
        setupScript: "true",
        env: {},
        timeoutSec: 30,
      },
    },
  };
}

function createWorkspace(workspaceRoot) {
  return {
    eventId: "evt-1",
    eventType: "issues",
    githubRepoId: 1,
    owner: "octocat",
    repo: "demo",
    repoPath: "/tmp/github-flows/ws/octocat/demo/issues/evt-1/repo",
    repositoryCachePath: "/tmp/github-flows/cache/repo/octocat/demo",
    workspaceRoot,
    workspacePath: "/tmp/github-flows/ws/octocat/demo/issues/evt-1",
  };
}

function createLoggingContext() {
  return {
    eventId: "evt-1",
    eventType: "issues",
    logDirectory: "/tmp/github-flows/log/run/octocat/demo/evt-1",
    owner: "octocat",
    repo: "demo",
  };
}

test("prompt materializer resolves prompt variables from event fields and persists applied bindings", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-prompt-"));
  const templateDir = path.join(workspaceRoot, "cfg", "issues");
  const persisted = [];
  await fs.mkdir(templateDir, { recursive: true });
  await fs.writeFile(path.join(templateDir, "default.md"), "PR {{PR_TITLE}} for {{repo}} in {{owner}}.", "utf8");

  const materializer = new Github_Flows_Execution_Preparation_Prompt_Materializer({
    eventLog: {
      async logEventProcessing() {},
      async persistPromptBindings(entry) {
        persisted.push(entry);
      },
    },
    fsPromises: fs,
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    const result = await materializer.materialize({
      event: {
        pull_request: { title: "Fix race condition" },
        repository: { name: "demo" },
      },
      loggingContext: createLoggingContext(),
      selectedProfile: createSelectedProfile({
        promptVariables: {
          PR_TITLE: "event.pull_request.title",
        },
      }),
      workspace: createWorkspace(workspaceRoot),
    });

    assert.deepEqual(result, {
      prompt: "PR Fix race condition for demo in octocat.",
      promptBindings: {
        PR_TITLE: "Fix race condition",
      },
    });
    assert.deepEqual(persisted, [{
      bindings: { PR_TITLE: "Fix race condition" },
      loggingContext: createLoggingContext(),
    }]);
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("prompt materializer resolves prompt variables from preparation-time workspace values", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-prompt-"));
  const templateDir = path.join(workspaceRoot, "cfg", "issues");
  await fs.mkdir(templateDir, { recursive: true });
  await fs.writeFile(path.join(templateDir, "default.md"), "Workspace {{WS_PATH}} event {{eventId}}.", "utf8");

  const materializer = new Github_Flows_Execution_Preparation_Prompt_Materializer({
    eventLog: { async logEventProcessing() {} },
    fsPromises: fs,
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    const result = await materializer.materialize({
      event: {},
      loggingContext: createLoggingContext(),
      selectedProfile: createSelectedProfile({
        promptVariables: {
          WS_PATH: "workspace.workspacePath",
        },
      }),
      workspace: createWorkspace(workspaceRoot),
    });

    assert.equal(result.prompt, "Workspace /tmp/github-flows/ws/octocat/demo/issues/evt-1 event evt-1.");
    assert.deepEqual(result.promptBindings, {
      WS_PATH: "/tmp/github-flows/ws/octocat/demo/issues/evt-1",
    });
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("prompt materializer does not persist prompt-bindings artifact when no bindings are applied", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-prompt-"));
  const templateDir = path.join(workspaceRoot, "cfg", "issues");
  const persisted = [];
  await fs.mkdir(templateDir, { recursive: true });
  await fs.writeFile(path.join(templateDir, "default.md"), "Repo {{repo}} at {{workspacePath}} for {{eventId}}.", "utf8");

  const materializer = new Github_Flows_Execution_Preparation_Prompt_Materializer({
    eventLog: {
      async logEventProcessing() {},
      async persistPromptBindings(entry) {
        persisted.push(entry);
      },
    },
    fsPromises: fs,
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    const result = await materializer.materialize({
      event: {},
      loggingContext: createLoggingContext(),
      selectedProfile: createSelectedProfile(),
      workspace: createWorkspace(workspaceRoot),
    });

    assert.equal(result.prompt, "Repo demo at /tmp/github-flows/ws/octocat/demo/issues/evt-1 for evt-1.");
    assert.deepEqual(result.promptBindings, {});
    assert.deepEqual(persisted, []);
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("prompt materializer fails when a declared event binding cannot be resolved", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-prompt-"));
  const templateDir = path.join(workspaceRoot, "cfg", "issues");
  await fs.mkdir(templateDir, { recursive: true });
  await fs.writeFile(path.join(templateDir, "default.md"), "PR {{PR_TITLE}}.", "utf8");

  const materializer = new Github_Flows_Execution_Preparation_Prompt_Materializer({
    eventLog: { async logEventProcessing() {} },
    fsPromises: fs,
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    await assert.rejects(
      materializer.materialize({
        event: {},
        loggingContext: createLoggingContext(),
        selectedProfile: createSelectedProfile({
          promptVariables: {
            PR_TITLE: "event.pull_request.title",
          },
        }),
        workspace: createWorkspace(workspaceRoot),
      }),
      /Unable to resolve prompt binding to exactly one value/,
    );
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("prompt materializer fails when a declared binding resolves to a non-scalar value", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-prompt-"));
  const templateDir = path.join(workspaceRoot, "cfg", "issues");
  await fs.mkdir(templateDir, { recursive: true });
  await fs.writeFile(path.join(templateDir, "default.md"), "PR {{PR}}.", "utf8");

  const materializer = new Github_Flows_Execution_Preparation_Prompt_Materializer({
    eventLog: { async logEventProcessing() {} },
    fsPromises: fs,
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    await assert.rejects(
      materializer.materialize({
        event: {
          pull_request: { title: "Fix bug" },
        },
        loggingContext: createLoggingContext(),
        selectedProfile: createSelectedProfile({
          promptVariables: {
            PR: "event.pull_request",
          },
        }),
        workspace: createWorkspace(workspaceRoot),
      }),
      /Unable to resolve prompt binding to exactly one value/,
    );
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("prompt materializer rejects promptRef that escapes cfg", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-prompt-"));
  const materializer = new Github_Flows_Execution_Preparation_Prompt_Materializer({
    eventLog: { async logEventProcessing() {} },
    fsPromises: fs,
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    await assert.rejects(
      materializer.materialize({
        event: {},
        loggingContext: createLoggingContext(),
        selectedProfile: createSelectedProfile({
          promptRef: "../secrets.md",
        }),
        workspace: createWorkspace(workspaceRoot),
      }),
      /cfg\//,
    );
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

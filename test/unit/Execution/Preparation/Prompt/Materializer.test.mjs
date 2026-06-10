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
    execution: {
      handler: {
        type: "agent",
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
          required: {
            PR_TITLE: "event.pull_request.title",
          },
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
          required: {
            WS_PATH: "workspace.workspacePath",
          },
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

test("prompt materializer resolves prompt variables from host-provided attributes", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-prompt-"));
  const templateDir = path.join(workspaceRoot, "cfg", "issues");
  await fs.mkdir(templateDir, { recursive: true });
  await fs.writeFile(path.join(templateDir, "default.md"), "Lane {{REVIEW_LANE}} by {{ACTOR}}.", "utf8");

  const materializer = new Github_Flows_Execution_Preparation_Prompt_Materializer({
    eventLog: { async logEventProcessing() {} },
    fsPromises: fs,
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    const result = await materializer.materialize({
      event: {},
      hostAttributes: {
        actor: "octocat",
        reviewLane: "urgent",
      },
      loggingContext: createLoggingContext(),
      selectedProfile: createSelectedProfile({
        promptVariables: {
          required: {
            ACTOR: "host.actor",
            REVIEW_LANE: "host.reviewLane",
          },
        },
      }),
      workspace: createWorkspace(workspaceRoot),
    });

    assert.equal(result.prompt, "Lane urgent by octocat.");
    assert.deepEqual(result.promptBindings, {
      ACTOR: "octocat",
      REVIEW_LANE: "urgent",
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
            required: {
              PR_TITLE: "event.pull_request.title",
            },
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
            required: {
              PR: "event.pull_request",
            },
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

test("prompt materializer omits unresolved optional bindings without defaults", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-prompt-"));
  const templateDir = path.join(workspaceRoot, "cfg", "issues");
  await fs.mkdir(templateDir, { recursive: true });
  await fs.writeFile(path.join(templateDir, "default.md"), "Actor {{ACTOR}}.", "utf8");

  const materializer = new Github_Flows_Execution_Preparation_Prompt_Materializer({
    eventLog: { async logEventProcessing() {} },
    fsPromises: fs,
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    const result = await materializer.materialize({
      event: {},
      hostAttributes: {},
      loggingContext: createLoggingContext(),
      selectedProfile: createSelectedProfile({
        promptVariables: {
          required: {
            ACTOR: "workspace.owner",
          },
          optional: {
            REVIEW_LANE: {
              path: "host.reviewLane",
            },
          },
        },
      }),
      workspace: createWorkspace(workspaceRoot),
    });
    assert.equal(result.prompt, "Actor octocat.");
    assert.deepEqual(result.promptBindings, {
      ACTOR: "octocat",
    });
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("prompt materializer uses optional defaults when host bindings are absent", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-prompt-"));
  const templateDir = path.join(workspaceRoot, "cfg", "issues");
  await fs.mkdir(templateDir, { recursive: true });
  await fs.writeFile(path.join(templateDir, "default.md"), "Lane {{REVIEW_LANE}}.", "utf8");

  const materializer = new Github_Flows_Execution_Preparation_Prompt_Materializer({
    eventLog: { async logEventProcessing() {} },
    fsPromises: fs,
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    const result = await materializer.materialize({
      event: {},
      hostAttributes: {},
      loggingContext: createLoggingContext(),
      selectedProfile: createSelectedProfile({
        promptVariables: {
          optional: {
            REVIEW_LANE: {
              path: "host.reviewLane",
              default: "default",
            },
          },
        },
      }),
      workspace: createWorkspace(workspaceRoot),
    });
    assert.equal(result.prompt, "Lane default.");
    assert.deepEqual(result.promptBindings, {
      REVIEW_LANE: "default",
    });
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("prompt materializer converts null optional defaults to empty strings for prompt text", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-prompt-"));
  const templateDir = path.join(workspaceRoot, "cfg", "issues");
  await fs.mkdir(templateDir, { recursive: true });
  await fs.writeFile(path.join(templateDir, "default.md"), "Lane '{{REVIEW_LANE}}'.", "utf8");

  const materializer = new Github_Flows_Execution_Preparation_Prompt_Materializer({
    eventLog: { async logEventProcessing() {} },
    fsPromises: fs,
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    const result = await materializer.materialize({
      event: {},
      hostAttributes: {},
      loggingContext: createLoggingContext(),
      selectedProfile: createSelectedProfile({
        promptVariables: {
          optional: {
            REVIEW_LANE: {
              path: "host.reviewLane",
              default: null,
            },
          },
        },
      }),
      workspace: createWorkspace(workspaceRoot),
    });
    assert.equal(result.prompt, "Lane ''.");
    assert.deepEqual(result.promptBindings, {
      REVIEW_LANE: "",
    });
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("prompt materializer fails when a declared required host binding cannot be resolved", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-prompt-"));
  const templateDir = path.join(workspaceRoot, "cfg", "issues");
  await fs.mkdir(templateDir, { recursive: true });
  await fs.writeFile(path.join(templateDir, "default.md"), "Lane {{REVIEW_LANE}}.", "utf8");

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
        hostAttributes: {},
        loggingContext: createLoggingContext(),
        selectedProfile: createSelectedProfile({
          promptVariables: {
            required: {
              REVIEW_LANE: "host.reviewLane",
            },
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

test("prompt materializer preserves legacy flat-map promptVariables as required bindings", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-prompt-"));
  const templateDir = path.join(workspaceRoot, "cfg", "issues");
  await fs.mkdir(templateDir, { recursive: true });
  await fs.writeFile(path.join(templateDir, "default.md"), "Issue {{ISSUE_TITLE}}.", "utf8");

  const materializer = new Github_Flows_Execution_Preparation_Prompt_Materializer({
    eventLog: { async logEventProcessing() {} },
    fsPromises: fs,
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    const result = await materializer.materialize({
      event: {
        issue: { title: "Legacy issue" },
      },
      loggingContext: createLoggingContext(),
      selectedProfile: createSelectedProfile({
        promptVariables: {
          ISSUE_TITLE: "event.issue.title",
        },
      }),
      workspace: createWorkspace(workspaceRoot),
    });
    assert.equal(result.prompt, "Issue Legacy issue.");
    assert.deepEqual(result.promptBindings, {
      ISSUE_TITLE: "Legacy issue",
    });
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("prompt materializer rejects mixed legacy and structured promptVariables", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-prompt-"));
  const templateDir = path.join(workspaceRoot, "cfg", "issues");
  await fs.mkdir(templateDir, { recursive: true });
  await fs.writeFile(path.join(templateDir, "default.md"), "Issue {{ISSUE_TITLE}}.", "utf8");

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
          issue: { title: "Mixed issue" },
        },
        loggingContext: createLoggingContext(),
        selectedProfile: createSelectedProfile({
          promptVariables: {
            ISSUE_TITLE: "event.issue.title",
            optional: {
              REVIEW_LANE: {
                path: "host.reviewLane",
              },
            },
          },
        }),
        workspace: createWorkspace(workspaceRoot),
      }),
      /Legacy and structured prompt variable forms must not be mixed/,
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

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import Github_Flows_Execution_Preparation_Prompt_Materializer from "../../../../../src/Execution/Preparation/Prompt/Materializer.mjs";

test("prompt materializer resolves template relative to promptRef source and replaces placeholders", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-prompt-"));
  const templateDir = path.join(workspaceRoot, "cfg", "issues");
  await fs.mkdir(templateDir, { recursive: true });
  await fs.writeFile(path.join(templateDir, "default.md"), "Repo {{event.repository.name}} at {{workspacePath}} for {{eventId}}.", "utf8");

  const materializer = new Github_Flows_Execution_Preparation_Prompt_Materializer({
    fsPromises: fs,
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    const prompt = await materializer.materialize({
      event: {
        eventId: "evt-1",
        repository: { name: "demo" },
      },
      selectedProfile: {
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
          },
          runtime: {
            image: "codex-agent",
            setupScript: "true",
            env: {},
            timeoutSec: 30,
          },
        },
      },
      workspace: {
        eventId: "evt-1",
        eventType: "issues",
        githubRepoId: 1,
        owner: "octocat",
        repo: "demo",
        repoPath: "/tmp/github-flows/ws/octocat/demo/issues/evt-1/repo",
        repositoryCachePath: "/tmp/github-flows/cache/repo/octocat/demo",
        workspaceRoot,
        workspacePath: "/tmp/github-flows/ws/octocat/demo/issues/evt-1",
      },
    });

    assert.equal(prompt, "Repo demo at /tmp/github-flows/ws/octocat/demo/issues/evt-1 for evt-1.");
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("prompt materializer rejects promptRef that escapes cfg", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-prompt-"));
  const materializer = new Github_Flows_Execution_Preparation_Prompt_Materializer({
    fsPromises: fs,
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    await assert.rejects(
      materializer.materialize({
        event: {},
        selectedProfile: {
          id: "issues/profile.json",
          orderKey: "issues/profile.json",
          promptRefBaseDir: "issues",
          trigger: {},
          type: "docker",
          execution: {
            handler: {
              type: "codex",
              command: ["node"],
              args: [],
              promptRef: "../secrets.md",
            },
            runtime: {
              image: "codex-agent",
              setupScript: "true",
              env: {},
              timeoutSec: 30,
            },
          },
        },
        workspace: {
          eventId: "evt-1",
          eventType: "issues",
          githubRepoId: 1,
          owner: "octocat",
          repo: "demo",
          repoPath: "/tmp/github-flows/ws/octocat/demo/issues/evt-1/repo",
          repositoryCachePath: "/tmp/github-flows/cache/repo/octocat/demo",
          workspaceRoot,
          workspacePath: "/tmp/github-flows/ws/octocat/demo/issues/evt-1",
        },
      }),
      /cfg\//,
    );
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

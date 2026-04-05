import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import Github_Flows_Execution_Profile_Resolver from "../../../../src/Execution/Profile/Resolver.mjs";

async function writeProfile(workspaceRoot, relativeDir, content) {
  const directory = path.join(workspaceRoot, "cfg", relativeDir);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "profile.json"), JSON.stringify(content, null, 2), "utf8");
}

test("profile resolver merges fragment chain from root to leaf candidate", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-profile-"));
  const logs = [];
  const resolver = new Github_Flows_Execution_Profile_Resolver({
    fsPromises: fs,
    logger: { logComponentAction(entry) { logs.push(entry); } },
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    await writeProfile(workspaceRoot, "a", {
      type: "docker",
      trigger: { event: "issues" },
      launch: {
        handler: { type: "codex", command: ["node", "root.mjs"], args: [] },
        prompt: "root prompt",
        runtime: { image: "root-image", setupScript: "test -d repo", env: { ROOT: "1" }, timeoutSec: 60 },
      },
    });
    await writeProfile(workspaceRoot, path.join("a", "b"), {
      trigger: { action: "opened", repository: "octocat/demo" },
      launch: {
        handler: { command: ["node", "leaf.mjs"], args: ["--leaf"] },
        prompt: "leaf prompt",
        runtime: { image: "leaf-image", setupScript: "test -d repo", env: { LEAF: "1" } },
      },
    });

    const result = await resolver.resolveByGithubEvent({
      headers: { "x-github-event": "issues" },
      payload: {
        action: "opened",
        repository: {
          name: "demo",
          owner: { login: "octocat" },
        },
      },
    });

    assert.equal(result.candidates.length, 1);
    assert.equal(result.selectedProfile?.id, "a/b/profile.json");
    assert.deepEqual(result.applicabilityBasis, {
      event: "issues",
      action: "opened",
      repository: "octocat/demo",
    });
    assert.deepEqual(result.selectedProfile?.launch, {
      handler: {
        type: "codex",
        command: ["node", "leaf.mjs"],
        args: ["--leaf"],
      },
      prompt: "leaf prompt",
      runtime: {
        image: "leaf-image",
        env: {
          ROOT: "1",
          LEAF: "1",
        },
        setupScript: "test -d repo",
        timeoutSec: 60,
      },
    });
    assert.equal(result.selectedProfile?.type, "docker");
    assert.equal(logs[0].action, "resolve-effective-profile");
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("profile resolver selects highest specificity then stable filesystem order", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-profile-"));
  const resolver = new Github_Flows_Execution_Profile_Resolver({
    fsPromises: fs,
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    await writeProfile(workspaceRoot, "a", {
      type: "docker",
      trigger: { event: "issues", repository: "octocat/demo" },
      launch: { handler: { type: "codex", command: ["node"], args: [] }, prompt: "a", runtime: { image: "a-image", setupScript: "true", env: {}, timeoutSec: 30 } },
    });
    await writeProfile(workspaceRoot, "b", {
      type: "docker",
      trigger: { event: "issues", action: "opened" },
      launch: { handler: { type: "codex", command: ["node"], args: [] }, prompt: "b", runtime: { image: "b-image", setupScript: "true", env: {}, timeoutSec: 30 } },
    });

    let result = await resolver.resolveByGithubEvent({
      headers: { "x-github-event": "issues" },
      payload: {
        action: "opened",
        repository: { name: "demo", owner: { login: "octocat" } },
      },
    });
    assert.equal(result.selectedProfile?.id, "a/profile.json");

    result = await resolver.resolveByGithubEvent({
      headers: { "x-github-event": "issues" },
      payload: {
        action: "closed",
        repository: { name: "demo", owner: { login: "octocat" } },
      },
    });
    assert.equal(result.selectedProfile?.id, "a/profile.json");
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("profile resolver returns no selected profile when nothing matches", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-profile-"));
  const resolver = new Github_Flows_Execution_Profile_Resolver({
    fsPromises: fs,
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    await writeProfile(workspaceRoot, ".", {
      type: "docker",
      trigger: { event: "pull_request" },
      launch: { handler: { type: "codex", command: ["node"], args: [] }, prompt: "pr", runtime: { image: "pr-image", setupScript: "true", env: {}, timeoutSec: 30 } },
    });

    const result = await resolver.resolveByGithubEvent({
      headers: { "x-github-event": "issues" },
      payload: {
        action: "opened",
        repository: { name: "demo", owner: { login: "octocat" } },
      },
    });

    assert.equal(result.selectedProfile, null);
    assert.deepEqual(result.matchedCandidates, []);
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

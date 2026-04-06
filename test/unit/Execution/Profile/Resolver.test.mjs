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
      trigger: { event: "issues" },
      execution: {
        handler: { type: "codex", command: ["node", "root.mjs"], args: [], promptRef: "root.md" },
        runtime: { type: "docker", image: "root-image", setupScript: "test -d repo", env: { ROOT: "1" }, timeoutSec: 60 },
      },
    });
    await writeProfile(workspaceRoot, path.join("a", "b"), {
      trigger: { action: "opened", repository: "octocat/demo" },
      execution: {
        handler: { command: ["node", "leaf.mjs"], args: ["--leaf"], promptRef: "leaf.md" },
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

    assert.equal(result.candidates.length, 2);
    assert.deepEqual(result.candidates.map((item) => item.id), [
      "a/b/profile.json",
      "a/profile.json",
    ]);
    assert.equal(result.selectedProfile?.id, "a/b/profile.json");
    assert.deepEqual(result.applicabilityBasis, {
      event: "issues",
      action: "opened",
      repository: "octocat/demo",
    });
    assert.deepEqual(result.selectedProfile?.execution, {
      handler: {
        type: "codex",
        command: ["node", "leaf.mjs"],
        args: ["--leaf"],
        promptRef: "leaf.md",
      },
      runtime: {
        type: "docker",
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
    assert.equal(result.selectedProfile?.promptRefBaseDir, "a/b");
    assert.equal(logs[0].action, "build-candidate-profile-registry");
    assert.equal(logs[1].action, "resolve-effective-profile");
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("profile resolver builds candidates for every discovered profile path and logs the registry inputs", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-profile-"));
  const logs = [];
  const resolver = new Github_Flows_Execution_Profile_Resolver({
    fsPromises: fs,
    logger: { logComponentAction(entry) { logs.push(entry); } },
    pathModule: path,
    runtime: { workspaceRoot },
  });

  try {
    await writeProfile(workspaceRoot, ".", {
      trigger: { event: "issues" },
      execution: { runtime: { type: "docker", image: "root-image" } },
    });
    await writeProfile(workspaceRoot, "site", {
      trigger: { repository: "octocat/demo" },
      execution: { runtime: { env: { SITE: "1" } } },
    });
    await writeProfile(workspaceRoot, path.join("site", "group"), {
      trigger: { action: "opened" },
      execution: { runtime: { env: { GROUP: "1" } } },
    });

    const result = await resolver.resolveByGithubEvent({
      headers: { "x-github-event": "issues" },
      payload: {
        action: "opened",
        repository: { name: "demo", owner: { login: "octocat" } },
      },
    });

    assert.deepEqual(result.candidates.map((item) => item.id), [
      "profile.json",
      "site/group/profile.json",
      "site/profile.json",
    ]);

    const registryLog = logs.find((entry) => entry.action === "build-candidate-profile-registry");
    assert.deepEqual(registryLog?.details, {
      workspaceRoot,
      cfgRoot: path.resolve(workspaceRoot, "cfg"),
      discoveredProfileFiles: [
        { directory: ".", path: path.resolve(workspaceRoot, "cfg", "profile.json") },
        { directory: "site", path: path.resolve(workspaceRoot, "cfg", "site", "profile.json") },
        { directory: "site/group", path: path.resolve(workspaceRoot, "cfg", "site", "group", "profile.json") },
      ],
      constructedCandidates: [
        {
          filesystemPath: path.resolve(workspaceRoot, "cfg"),
          fragments: ["."],
          id: "profile.json",
          orderKey: "profile.json",
        },
        {
          filesystemPath: path.resolve(workspaceRoot, "cfg", "site", "group"),
          fragments: [".", "site", "site/group"],
          id: "site/group/profile.json",
          orderKey: "site/group/profile.json",
        },
        {
          filesystemPath: path.resolve(workspaceRoot, "cfg", "site"),
          fragments: [".", "site"],
          id: "site/profile.json",
          orderKey: "site/profile.json",
        },
      ],
    });
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
      trigger: { event: "issues", repository: "octocat/demo" },
      execution: { handler: { type: "codex", command: ["node"], args: [], promptRef: "a.md" }, runtime: { type: "docker", image: "a-image", setupScript: "true", env: {}, timeoutSec: 30 } },
    });
    await writeProfile(workspaceRoot, "b", {
      trigger: { event: "issues", action: "opened" },
      execution: { handler: { type: "codex", command: ["node"], args: [], promptRef: "b.md" }, runtime: { type: "docker", image: "b-image", setupScript: "true", env: {}, timeoutSec: 30 } },
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
      trigger: { event: "pull_request" },
      execution: { handler: { type: "codex", command: ["node"], args: [], promptRef: "pr.md" }, runtime: { type: "docker", image: "pr-image", setupScript: "true", env: {}, timeoutSec: 30 } },
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

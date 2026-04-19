import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";

import Container from "../../../node_modules/@teqfw/di/src/Container.mjs";
import NamespaceRegistry from "../../../node_modules/@teqfw/di/src/Config/NamespaceRegistry.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../..");

const installFakeGh = async function (workspaceRoot) {
  const binDir = path.join(workspaceRoot, "bin");
  const scriptPath = path.join(binDir, "gh");
  await fs.mkdir(binDir, { recursive: true });
  await fs.writeFile(
    scriptPath,
    `#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "repo" ] && [ "$2" = "clone" ]; then
  target="$4"
  mkdir -p "$target/.git"
  exit 0
fi
exit 1
`,
    "utf8",
  );
  await fs.chmod(scriptPath, 0o755);
  return binDir;
};

const installFakeGit = async function (workspaceRoot) {
  const binDir = path.join(workspaceRoot, "bin");
  const scriptPath = path.join(binDir, "git");
  await fs.mkdir(binDir, { recursive: true });
  await fs.writeFile(
    scriptPath,
    `#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "clone" ] && [ "$2" = "--no-hardlinks" ]; then
  target="$4"
  mkdir -p "$target/.git"
  exit 0
fi
if [ "$1" = "-C" ] && [ "$3" = "remote" ] && [ "$4" = "get-url" ] && [ "$5" = "origin" ]; then
  printf 'git@github.com:octocat/demo.git\\n'
  exit 0
fi
if [ "$1" = "-C" ] && [ "$3" = "remote" ] && [ "$4" = "set-url" ] && [ "$5" = "origin" ]; then
  exit 0
fi
if [ "$1" = "-C" ] && [ "$3" = "pull" ]; then
  exit 0
fi
exit 1
`,
    "utf8",
  );
  await fs.chmod(scriptPath, 0o755);
  return binDir;
};

const installFakeDocker = async function (workspaceRoot) {
  const binDir = path.join(workspaceRoot, "bin");
  const scriptPath = path.join(binDir, "docker");
  await fs.mkdir(binDir, { recursive: true });
  await fs.writeFile(
    scriptPath,
    `#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "run" ]; then
  exit 0
fi
exit 1
`,
    "utf8",
  );
  await fs.chmod(scriptPath, 0o755);
  return binDir;
};

const writeProfile = async function (workspaceRoot, relativeDir, content) {
  const directory = path.join(workspaceRoot, "cfg", relativeDir);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "profile.json"), JSON.stringify(content, null, 2), "utf8");
};

const writePrompt = async function (workspaceRoot, relativePath, content) {
  const filePath = path.join(workspaceRoot, "cfg", relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
};

const sendRequest = function (port, { body = "", headers = {}, method = "GET", pathname = "/" } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: pathname,
        method,
        headers:
          method === "GET" || method === "HEAD"
            ? headers
            : {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(body),
                ...headers,
              },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    request.on("error", reject);
    request.write(body);
    request.end();
  });
};

const waitForAddress = async function (server) {
  for (let i = 0; i < 100; i += 1) {
    const address = server.getInstance()?.address?.();
    if (address?.port !== undefined) return address;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Server did not expose a listening address.");
};

const createContainer = async function () {
  const container = new Container();
  container.enableTestMode();
  const registry = new NamespaceRegistry({ fs, path, appRoot: projectRoot });
  const entries = await registry.build();
  for (const entry of entries) {
    container.addNamespaceRoot(entry.prefix, entry.dirAbs, entry.ext);
  }
  return container;
};

const createSignature = function (secret, body) {
  const digest = createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${digest}`;
};

test("webhook ingress is served on the static GitHub webhook path", { timeout: 5000 }, async () => {
  const container = await createContainer();
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-"));
  const fakeGhDir = await installFakeGh(workspaceRoot);
  const fakeGitDir = await installFakeGit(workspaceRoot);
  const fakeDockerDir = await installFakeDocker(workspaceRoot);
  const originalPath = process.env.PATH;
  const runtimeFactory = await container.get("Github_Flows_Config_Runtime__Factory$");
  const server = await container.get("Github_Flows_Web_Server$");
  const secret = "shared-secret";

  runtimeFactory.configure({
    httpHost: "127.0.0.1",
    httpPort: 0,
    workspaceRoot,
    webhookSecret: secret,
  });
  runtimeFactory.freeze();
  process.env.PATH = `${fakeDockerDir}:${fakeGitDir}:${fakeGhDir}:${originalPath ?? ""}`;

  try {
    await writeProfile(workspaceRoot, "issues", {
      trigger: {
        event: "issues",
        repository: "octocat/demo",
        action: "opened",
      },
      execution: {
        handler: {
          type: "codex",
          command: ["node"],
          args: [],
          promptRef: "default.md",
          promptVariables: {
            ISSUE_TITLE: "event.issue.title",
          },
        },
        runtime: {
          type: "docker",
          dockerArgs: [],
          image: "profile-image",
          setupScript: "true",
          env: {},
          timeoutSec: 30,
        },
      },
    });
    await writePrompt(workspaceRoot, path.join("issues", "default.md"), "Issue {{ISSUE_TITLE}} for {{repo}} prepared at {{workspacePath}}.");
    await server.start();
    const address = await waitForAddress(server);
    const validBody = JSON.stringify({
      action: "opened",
      eventId: "evt-1",
      issue: {
        title: "Integration issue",
      },
      repository: {
        id: 1,
        name: "demo",
        owner: {
          login: "octocat",
        },
      },
    });

    const ok = await sendRequest(address.port, {
      method: "POST",
      pathname: "/webhooks/github",
      body: validBody,
      headers: {
        "x-github-event": "issues",
        "x-hub-signature-256": createSignature(secret, validBody),
      },
    });

    const missing = await sendRequest(address.port, {
      method: "POST",
      pathname: "/missing",
      body: validBody,
      headers: {
        "x-github-event": "issues",
        "x-hub-signature-256": createSignature(secret, validBody),
      },
    });

    const unauthorized = await sendRequest(address.port, {
      method: "POST",
      pathname: "/webhooks/github",
      body: validBody,
      headers: {
        "x-github-event": "issues",
        "x-hub-signature-256": createSignature("wrong-secret", validBody),
      },
    });

    assert.equal(ok.statusCode, 202);
    assert.equal(ok.body, '{"status":"accepted"}');
    assert.equal(missing.statusCode, 404);
    assert.equal(unauthorized.statusCode, 401);
    assert.equal(unauthorized.body, '{"error":"unauthorized"}');
    await assert.doesNotReject(
      fs.stat(path.resolve(workspaceRoot, "cache", "repo", "octocat", "demo", ".git")),
    );
    await assert.doesNotReject(
      fs.stat(path.resolve(workspaceRoot, "ws", "octocat", "demo", "issues", "evt-1", "repo", ".git")),
    );
    const eventScope = path.resolve(workspaceRoot, "log", "run", "octocat", "demo", "evt-1");
    const eventSnapshot = JSON.parse(await fs.readFile(path.resolve(eventScope, "event.json"), "utf8"));
    const effectiveProfile = JSON.parse(await fs.readFile(path.resolve(eventScope, "effective-profile.json"), "utf8"));
    const promptBindings = JSON.parse(await fs.readFile(path.resolve(eventScope, "prompt-bindings.json"), "utf8"));
    const eventsLog = (await fs.readFile(path.resolve(eventScope, "events.log"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    assert.equal(eventSnapshot.body.eventId, "evt-1");
    assert.equal(eventSnapshot.headers["x-github-event"], "issues");
    assert.equal(effectiveProfile.id, "issues/profile.json");
    assert.deepEqual(promptBindings, {
      ISSUE_TITLE: "Integration issue",
    });
    assert.ok(eventsLog.length > 0);
    assert.equal(
      await fs.readFile(path.resolve(eventScope, "stdout.log"), "utf8"),
      "",
    );
    assert.equal(
      await fs.readFile(path.resolve(eventScope, "stderr.log"), "utf8"),
      "",
    );
  } finally {
    process.env.PATH = originalPath;
    await server.stop();
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

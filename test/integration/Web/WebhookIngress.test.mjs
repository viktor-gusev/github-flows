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

test("webhook ingress is served on the static GitHub webhook path", async () => {
  const container = await createContainer();
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-"));
  const fakeBinDir = await installFakeGh(workspaceRoot);
  const originalPath = process.env.PATH;
  const runtimeFactory = await container.get("Github_Flows_Config_Runtime__Factory$");
  const server = await container.get("Github_Flows_Web_Server$");
  const secret = "shared-secret";

  runtimeFactory.configure({
    httpHost: "127.0.0.1",
    httpPort: 0,
    workspaceRoot,
    runtimeImage: "codex-agent",
    webhookSecret: secret,
  });
  runtimeFactory.freeze();
  process.env.PATH = `${fakeBinDir}:${originalPath ?? ""}`;

  try {
    await server.start();
    const address = await waitForAddress(server);
    const validBody = JSON.stringify({
      action: "opened",
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
        "x-hub-signature-256": createSignature(secret, validBody),
      },
    });

    const missing = await sendRequest(address.port, {
      method: "POST",
      pathname: "/missing",
      body: validBody,
      headers: {
        "x-hub-signature-256": createSignature(secret, validBody),
      },
    });

    const unauthorized = await sendRequest(address.port, {
      method: "POST",
      pathname: "/webhooks/github",
      body: validBody,
      headers: {
        "x-hub-signature-256": createSignature("wrong-secret", validBody),
      },
    });

    assert.equal(ok.statusCode, 202);
    assert.equal(ok.body, '{"status":"accepted"}');
    assert.equal(missing.statusCode, 404);
    assert.equal(unauthorized.statusCode, 401);
    assert.equal(unauthorized.body, '{"error":"unauthorized"}');
  } finally {
    process.env.PATH = originalPath;
    await server.stop();
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

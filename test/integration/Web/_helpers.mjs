import fs from "node:fs/promises";
import { EventEmitter } from "node:events";
import os from "node:os";
import path from "node:path";
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";

import Github_Flows_Web_Handler_Webhook from "../../../src/Web/Handler/Webhook.mjs";
import Github_Flows_Web_Handler_Webhook_EventLog from "../../../src/Web/Handler/Webhook/EventLog.mjs";
import Github_Flows_Web_Handler_Webhook_Signature from "../../../src/Web/Handler/Webhook/Signature.mjs";
import Github_Flows_Event_Attribute_Provider_Holder from "../../../src/Event/Attribute/Provider/Holder.mjs";
import Github_Flows_Event_Attribute_Resolver from "../../../src/Event/Attribute/Resolver.mjs";
import Github_Flows_Event_Logging_Context from "../../../src/Event/Logging/Context.mjs";
import Github_Flows_Event_Model_Builder from "../../../src/Event/Model/Builder.mjs";
import Github_Flows_Execution_Launch_Contract_Factory from "../../../src/Execution/Launch/Contract/Factory.mjs";
import Github_Flows_Execution_Preparation_Prompt_Materializer from "../../../src/Execution/Preparation/Prompt/Materializer.mjs";
import Github_Flows_Execution_Profile_Resolver from "../../../src/Execution/Profile/Resolver.mjs";
import Github_Flows_Execution_Runtime_Docker from "../../../src/Execution/Runtime/Docker.mjs";
import Github_Flows_Execution_Start_Coordinator from "../../../src/Execution/Start/Coordinator.mjs";
import Github_Flows_Execution_Workspace_Preparer from "../../../src/Execution/Workspace/Preparer.mjs";
import Github_Flows_Repo_Cache_Manager from "../../../src/Repo/Cache/Manager.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../..");

export const createSignature = function (secret, body) {
  const digest = createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${digest}`;
};

export const createWorkspace = async function () {
  return await fs.mkdtemp(path.join(os.tmpdir(), "github-flows-"));
};

export const writeProfile = async function (workspaceRoot, relativeDir, content) {
  const directory = path.join(workspaceRoot, "cfg", relativeDir);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "profile.json"), JSON.stringify(content, null, 2), "utf8");
};

export const writePrompt = async function (workspaceRoot, relativePath, content) {
  const filePath = path.join(workspaceRoot, "cfg", relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
};

export const installFakeGh = async function (workspaceRoot) {
  const binDir = path.join(workspaceRoot, "bin");
  const scriptPath = path.join(binDir, "gh");
  const stateDir = path.join(workspaceRoot, "fake-bin-state");
  await fs.mkdir(binDir, { recursive: true });
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(
    scriptPath,
    `#!/usr/bin/env bash
set -euo pipefail
state_dir="\${FAKE_BIN_STATE_DIR:?}"
printf 'gh %s\\n' "$*" >> "$state_dir/commands.log"
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

export const installFakeGit = async function (workspaceRoot) {
  const binDir = path.join(workspaceRoot, "bin");
  const scriptPath = path.join(binDir, "git");
  const stateDir = path.join(workspaceRoot, "fake-bin-state");
  await fs.mkdir(binDir, { recursive: true });
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(
    scriptPath,
    `#!/usr/bin/env bash
set -euo pipefail
state_dir="\${FAKE_BIN_STATE_DIR:?}"
printf 'git %s\\n' "$*" >> "$state_dir/commands.log"
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

export const installFakeDocker = async function (workspaceRoot) {
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

export const createLogger = function (calls) {
  return {
    info(entry) {
      calls.push({ method: "info", entry });
    },
    logComponentAction(entry) {
      calls.push({ method: "logComponentAction", entry });
    },
  };
};

export const createProductHarness = async function ({ workspaceRoot, logger }) {
  const runtime = {
    httpHost: "127.0.0.1",
    httpPort: 3000,
    repoCacheLockPollIntervalMs: 10,
    repoCacheLockStaleMs: 60000,
    repoCacheLockTimeoutMs: 3000,
    webhookSecret: "shared-secret",
    workspaceRoot,
  };
  const eventLog = new Github_Flows_Web_Handler_Webhook_EventLog({
    fsPromises: fs,
    logger,
    pathModule: path,
  });
  const eventModelBuilder = new Github_Flows_Event_Model_Builder();
  const eventAttributeProviderHolder = new Github_Flows_Event_Attribute_Provider_Holder();
  const executionProfileResolver = new Github_Flows_Execution_Profile_Resolver({
    fsPromises: fs,
    logger,
    pathModule: path,
    runtime,
  });
  const executionLaunchContractFactory = new Github_Flows_Execution_Launch_Contract_Factory({
    eventLog,
    logger,
  });
  const executionPromptMaterializer = new Github_Flows_Execution_Preparation_Prompt_Materializer({
    eventLog,
    fsPromises: fs,
    logger,
    pathModule: path,
    runtime,
  });
  const repoCacheManager = new Github_Flows_Repo_Cache_Manager({
    childProcess: await import("node:child_process"),
    fsPromises: fs,
    logger,
    pathModule: path,
    runtime,
  });
  const executionWorkspacePreparer = new Github_Flows_Execution_Workspace_Preparer({
    childProcess: await import("node:child_process"),
    eventLog,
    fsPromises: fs,
    logger,
    pathModule: path,
    repoCacheManager,
    runtime,
  });
  const executionRuntimeDocker = new Github_Flows_Execution_Runtime_Docker({
    childProcess: await import("node:child_process"),
    eventLog,
    fsModule: await import("node:fs"),
    fsPromises: fs,
    logger,
    pathModule: path,
  });
  const executionStartCoordinator = new Github_Flows_Execution_Start_Coordinator({
    eventLog,
    executionLaunchContractFactory,
    executionPromptMaterializer,
    executionRuntimeDocker,
    executionWorkspacePreparer,
    logger,
  });
  const eventLoggingContext = new Github_Flows_Event_Logging_Context({
    pathModule: path,
    runtime,
  });
  const signature = new Github_Flows_Web_Handler_Webhook_Signature();
  const handler = new Github_Flows_Web_Handler_Webhook({
    eventAttributeResolver: new Github_Flows_Event_Attribute_Resolver({
      eventAttributeProviderHolder,
      eventModelBuilder,
      logger,
    }),
    eventLog,
    eventLoggingContext,
    eventModelBuilder,
    executionProfileResolver,
    executionStartCoordinator,
    runtime,
    signature,
  });

  return {
    handler,
    runtime,
  };
};

export const createRequest = function (body, secret, { deliveryId = "evt-1", event = "issues", url = "/webhooks/github" } = {}) {
  const request = new EventEmitter();
  request.url = url;
  request.headers = {
    "content-type": "application/json",
    "x-github-delivery": deliveryId,
    "x-github-event": event,
    "x-hub-signature-256": createSignature(secret, body),
  };
  queueMicrotask(() => {
    request.emit("data", Buffer.from(body, "utf8"));
    request.emit("end");
  });
  return request;
};

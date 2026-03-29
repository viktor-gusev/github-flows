import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import Github_Flows_Web_Server from "../../../src/Web/Server.mjs";
import { Data, Factory } from "../../../src/Config/Runtime.mjs";
import Github_Flows_Config_Runtime from "../../../src/Config/Runtime.mjs";

function createHttpStub() {
  const calls = [];

  class ServerStub extends EventEmitter {
    listen(port, host, callback) {
      calls.push({ method: "listen", port, host });
      callback?.();
      return this;
    }

    close(callback) {
      calls.push({ method: "close" });
      callback?.();
    }

    emitRequest(url) {
      const req = { url };
      const res = {
        statusCode: undefined,
        headers: undefined,
        body: "",
        writeHead(statusCode, headers) {
          this.statusCode = statusCode;
          this.headers = headers;
        },
        end(chunk = "") {
          this.body += chunk;
        },
      };
      this.emit("request", req, res);
      return res;
    }
  }

  const server = new ServerStub();
  const http = {
    createServer(handler) {
      server.on("request", handler);
      return server;
    },
  };

  return { calls, http, server };
}

function createRuntimeConfig({ port = 3000 } = {}) {
  const data = new Data();
  const factory = new Factory({ depData: data });
  const config = new Github_Flows_Config_Runtime({ depData: data });

  factory.configure({
    httpHost: "127.0.0.1",
    httpPort: port,
    workspaceRoot: "./var/work",
    runtimeImage: "codex-agent",
    webhookSecret: "shared-secret",
  });
  factory.freeze();

  return { config, data, factory };
}

test("web server starts with runtime config and responds to health endpoint", async () => {
  const { calls, http, server: serverStub } = createHttpStub();
  const { config } = createRuntimeConfig({ port: 3030 });
  const server = new Github_Flows_Web_Server({ http, config });

  await server.start();

  assert.equal(calls[0].method, "listen");
  assert.equal(calls[0].port, 3030);
  assert.equal(calls[0].host, "127.0.0.1");

  const res = serverStub.emitRequest("/health");
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, '{"ok":true}');

  await server.stop();
  assert.equal(calls.at(-1).method, "close");
});

test("web server returns 404 for unknown routes", async () => {
  const { http, server: serverStub } = createHttpStub();
  const { config } = createRuntimeConfig({ port: 3031 });
  const server = new Github_Flows_Web_Server({ http, config });

  await server.start();

  const res = serverStub.emitRequest("/missing");
  assert.equal(res.statusCode, 404);
  assert.equal(res.body, "Not Found");

  await server.stop();
});

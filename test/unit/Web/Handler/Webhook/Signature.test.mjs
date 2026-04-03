import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import Github_Flows_Web_Handler_Webhook_Signature from "../../../../../src/Web/Handler/Webhook/Signature.mjs";

function createSignature(secret, body) {
  const digest = createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${digest}`;
}

test("signature validator accepts valid github hmac sha256 signature", async () => {
  const validator = new Github_Flows_Web_Handler_Webhook_Signature();
  const body = Buffer.from('{"action":"opened"}', "utf8");

  const valid = await validator.isValid({
    body,
    secret: "shared-secret",
    signatureHeader: createSignature("shared-secret", body),
  });

  assert.equal(valid, true);
});

test("signature validator rejects invalid github hmac sha256 signature", async () => {
  const validator = new Github_Flows_Web_Handler_Webhook_Signature();
  const body = Buffer.from('{"action":"opened"}', "utf8");

  const valid = await validator.isValid({
    body,
    secret: "shared-secret",
    signatureHeader: createSignature("wrong-secret", body),
  });

  assert.equal(valid, false);
});

test("signature validator rejects malformed header", async () => {
  const validator = new Github_Flows_Web_Handler_Webhook_Signature();
  const body = Buffer.from('{"action":"opened"}', "utf8");

  const valid = await validator.isValid({
    body,
    secret: "shared-secret",
    signatureHeader: "sha256=zz",
  });

  assert.equal(valid, false);
});

import assert from "node:assert/strict";
import test from "node:test";

import Github_Flows_Event_Attribute_Provider_Holder from "../../../../../src/Event/Attribute/Provider/Holder.mjs";

test("event attribute provider holder stores one optional provider reference", async () => {
  const holder = new Github_Flows_Event_Attribute_Provider_Holder();
  const provider = {
    async getAttributes() {
      return { author: "octocat" };
    },
  };

  assert.equal(holder.get(), undefined);

  holder.set(provider);
  assert.equal(holder.get(), provider);

  holder.set(undefined);
  assert.equal(holder.get(), undefined);
});

test("event attribute provider holder rejects invalid providers", async () => {
  const holder = new Github_Flows_Event_Attribute_Provider_Holder();

  assert.throws(() => {
    holder.set({ provide() {} });
  }, /getAttributes/);
});

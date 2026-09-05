import test from "node:test";
import assert from "node:assert/strict";
import { sourceLoader } from "./load-source.mjs";

test("location sync rejects stale/offline fixes, checks RPC errors and retries only fresh fixes", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalNow = Date.now;
  const calls = [];
  let time = originalNow(),
    failure = true;
  Date.now = () => time;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true } });
  globalThis.__mapTestRpc = async (name, args) => {
    calls.push({ name, args });
    return { error: failure ? new Error("unavailable") : null };
  };
  const load = sourceLoader(process.cwd(), {
    "@/integrations/supabase/client":
      "export const supabase = { rpc: (...args) => globalThis.__mapTestRpc(...args) };",
  });
  const { deliveryTracker } = await load("src/services/delivery-location-tracker.ts");
  const fix = () => ({
    timestamp: time,
    coords: { latitude: 11, longitude: 76, accuracy: 5, heading: 0, speed: 0 },
  });
  try {
    assert.equal(
      await deliveryTracker.submitPosition({ ...fix(), timestamp: time - 6000 }, "a"),
      false,
    );
    assert.equal(calls.length, 0);
    assert.equal(await deliveryTracker.submitPosition(fix(), "a"), false);
    failure = false;
    time += 4000;
    assert.equal(await deliveryTracker.submitPosition(fix(), "a"), true);
    assert.equal(calls[1].name, "update_delivery_location");
    navigator.onLine = false;
    time += 4000;
    assert.equal(await deliveryTracker.submitPosition(fix(), "a"), false);
    assert.equal(calls.length, 2);
    navigator.onLine = true;
    time += 4000;
    assert.equal(await deliveryTracker.submitPosition(fix(), null), true);
    assert.equal(calls[2].args._captured_at, new Date(time).toISOString());
  } finally {
    Date.now = originalNow;
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else delete globalThis.navigator;
    delete globalThis.__mapTestRpc;
  }
});

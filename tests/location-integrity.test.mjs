import test from "node:test";
import assert from "node:assert/strict";
import { sourceLoader } from "./load-source.mjs";
const load = sourceLoader(process.cwd());
const { normalizeOrder } = await load("src/lib/shared-orders.ts");
const { vendorLivePin } = await load("src/lib/vendor-live-location.ts");

test("real coordinates outside Coimbatore are preserved and missing pins remain absent", () => {
  const order = normalizeOrder({
    customer_latitude: 9.98,
    customer_longitude: 76.3,
    seller: { lat: 9.99, lng: 76.31 },
  });
  assert.equal(order.customer_latitude, 9.98);
  assert.equal(order.vendors.latitude, 9.99);
  const missing = normalizeOrder({ seller: {} });
  assert.equal(missing.customer_latitude, null);
  assert.equal(missing.vendors.latitude, null);
});
test("vendor live guidance expires and rejects inaccurate or incomplete readings", () => {
  const now = Date.now();
  const row = {
    is_active: true,
    latitude: 11,
    longitude: 76,
    accuracy: 5,
    updated_at: new Date(now).toISOString(),
  };
  assert.deepEqual(vendorLivePin(row, now), { lat: 11, lng: 76 });
  for (const change of [
    { is_active: false },
    { accuracy: null },
    { accuracy: 2000 },
    { updated_at: new Date(now - 31000).toISOString() },
    { latitude: null },
  ])
    assert.equal(vendorLivePin({ ...row, ...change }, now), null);
});
test("GPS subscribers share one precise watch and release it only after the last listener", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let starts = 0,
    stops = 0,
    deliver,
    options;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      geolocation: {
        watchPosition(success, _error, opts) {
          starts++;
          deliver = success;
          options = opts;
          return 1;
        },
        clearWatch() {
          stops++;
        },
      },
    },
  });
  try {
    const { watchGPS } = await load("src/lib/gps-watch.ts");
    const values = [];
    const a = watchGPS((p) => values.push(p), assert.fail),
      b = watchGPS((p) => values.push(p), assert.fail);
    assert.equal(starts, 1);
    assert.equal(options.enableHighAccuracy, true);
    assert.equal(options.maximumAge, 0);
    deliver("fix");
    assert.deepEqual(values, ["fix", "fix"]);
    a();
    assert.equal(stops, 0);
    b();
    assert.equal(stops, 1);
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else delete globalThis.navigator;
  }
});
test("location service retains capture time, rejects poor fixes and propagates RPC errors without table writes", async () => {
  const calls = [];
  let failure = null;
  globalThis.__locationRPC = async (name, args) => {
    calls.push({ name, args });
    return { error: failure };
  };
  const isolated = sourceLoader(process.cwd(), {
    "@/integrations/supabase/client":
      "export const supabase={rpc:(...args)=>globalThis.__locationRPC(...args)};",
  });
  try {
    const { locationService } = await isolated("src/services/locationService.ts");
    const update = {
      latitude: 11,
      longitude: 76,
      accuracyM: 5,
      capturedAt: new Date().toISOString(),
    };
    await assert.rejects(
      locationService.submitCurrentLocation({ ...update, accuracyM: 15000 }),
      /precise/,
    );
    assert.equal(calls.length, 0);
    await locationService.submitCurrentLocation(update);
    assert.equal(calls[0].args._captured_at, update.capturedAt);
    failure = new Error("server rejected");
    await assert.rejects(locationService.submitCurrentLocation(update), /server rejected/);
  } finally {
    delete globalThis.__locationRPC;
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { sourceLoader } from "./load-source.mjs";
const load = sourceLoader(process.cwd());
const geo = await load("src/lib/coordinates.ts");
const routing = await load("src/lib/delivery-routing.ts");
const { normalizeOrder } = await load("src/lib/shared-orders.ts");
const { RouteRequest } = await load("src/lib/route-request.ts");

test("missing, blank, nonnumeric and out-of-range pins never become 0,0", () => {
  for (const pair of [
    [null, null],
    ["", ""],
    [undefined, 76],
    [false, 76],
    [91, 76],
    [11, 181],
    [0, 0],
  ])
    assert.equal(geo.parseCoordinates(...pair), null);
  assert.deepEqual(geo.parseCoordinates("11.5", "76.2"), { lat: 11.5, lng: 76.2 });
  assert.deepEqual(geo.parseCoordinates(0, 76), { lat: 0, lng: 76 });
});
test("all delivery views receive canonical pins and separate pickup address", () => {
  const order = normalizeOrder({
    seller: {
      lat: 11,
      lng: 76,
      address_line1: "Business",
      wizard_data: {
        pickupSame: false,
        pickupAddress: "Warehouse",
        pickupCity: "City",
        pickupLat: 12,
        pickupLng: 77,
      },
    },
  });
  assert.equal(order.vendors.address, "Warehouse, City");
  assert.equal(order.vendors.latitude, 12);
  assert.equal(order.vendors.longitude, 77);
  assert.equal(
    normalizeOrder({ seller: { lat: 11, lng: 76, wizard_data: { pickupSame: false } } }).vendors
      .latitude,
    null,
  );
  assert.equal(normalizeOrder({ seller: { lat: 11, lng: 76 } }).vendors.latitude, 11);
});
test("coarse, old and future GPS fixes are rejected; precise current fix accepted", () => {
  const now = Date.now();
  const fix = { timestamp: now, coords: { latitude: 11, longitude: 76, accuracy: 10 } };
  assert.equal(geo.usableGPS(fix, now), true);
  assert.equal(geo.usableGPS({ ...fix, timestamp: now - 31000 }, now), false);
  assert.equal(geo.usableGPS({ ...fix, timestamp: now + 5000 }, now), false);
  assert.equal(geo.usableGPS({ ...fix, coords: { ...fix.coords, accuracy: 2000 } }, now), false);
});
test("rider on a long segment is on-route and progress follows road length", () => {
  const geometry = [
    [76, 11],
    [76.01, 11],
  ];
  const p = routing.routeProgress({ lat: 11, lng: 76.005 }, geometry);
  assert.ok(p.offRouteMeters < 0.01);
  assert.ok(Math.abs(p.alongMeters / p.totalMeters - 0.5) < 0.0001);
  assert.ok(routing.distanceToPolylineMeters({ lat: 11.002, lng: 76.005 }, geometry) > 200);
});
test("maneuver distance follows metres, independent of uneven vertex spacing", () => {
  const geometry = [
    [76, 11],
    [76.0001, 11],
    [76.0002, 11],
    [76.01, 11],
  ];
  const steps = [
    { instruction: "Start", distanceMeters: 800 },
    { instruction: "Turn", distanceMeters: 200 },
    { instruction: "Arrive", distanceMeters: 0 },
  ];
  const next = routing.findNextStep({ lat: 11, lng: 76.005 }, steps, geometry);
  assert.equal(next.step.instruction, "Turn");
  assert.ok(Math.abs(next.distanceToStep - 300) < 1);
});
test("failed OSRM request rejects instead of fabricating a route", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  try {
    await assert.rejects(
      routing.fetchDeliveryRoute({ lat: 11, lng: 76 }, { lat: 12, lng: 77 }, "to_vendor", 0),
      /offline/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("valid road geometry uses longitude first; excessive road snapping is rejected", async () => {
  const original = globalThis.fetch;
  let url;
  const data = {
    code: "Ok",
    waypoints: [{ distance: 2 }, { distance: 3 }],
    routes: [
      {
        distance: 1000,
        duration: 120,
        geometry: {
          coordinates: [
            [76, 11],
            [77, 12],
          ],
        },
        legs: [{ steps: [] }],
      },
    ],
  };
  globalThis.fetch = async (value) => {
    url = value;
    return { ok: true, json: async () => data };
  };
  try {
    const result = await routing.fetchDeliveryRoute(
      { lat: 11, lng: 76 },
      { lat: 12, lng: 77 },
      "to_vendor",
      0,
    );
    assert.match(url, /76,11;77,12/);
    assert.equal(result.distanceMeters, 1000);
    data.waypoints[1].distance = 10000;
    await assert.rejects(
      routing.fetchDeliveryRoute({ lat: 11, lng: 76 }, { lat: 12, lng: 77 }, "to_vendor", 0),
      /too far/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("late response cannot overwrite a newer phase; cancellation discards completion", async () => {
  const request = new RouteRequest(),
    accepted = [];
  let first, second, firstSignal;
  const a = request.run(
    (signal) => {
      firstSignal = signal;
      return new Promise((resolve) => (first = resolve));
    },
    (v) => accepted.push(v),
    assert.fail,
  );
  const b = request.run(
    () => new Promise((resolve) => (second = resolve)),
    (v) => accepted.push(v),
    assert.fail,
  );
  assert.equal(firstSignal.aborted, true);
  second("customer");
  await b;
  first("shop");
  await a;
  assert.deepEqual(accepted, ["customer"]);
  let finish;
  const c = request.run(
    () => new Promise((resolve) => (finish = resolve)),
    (v) => accepted.push(v),
    assert.fail,
  );
  request.cancel();
  finish("obsolete");
  await c;
  assert.deepEqual(accepted, ["customer"]);
});

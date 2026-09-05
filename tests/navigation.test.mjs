import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { create, act } from "react-test-renderer";
import { sourceLoader } from "./load-source.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const load = sourceLoader(process.cwd(), {
  "@/services/delivery-location-tracker":
    "export const deliveryTracker = { submitPosition: async () => true };",
});
const { useDriverNavigation } = await load("src/hooks/useDriverNavigation.ts");

test("navigation waits for GPS, keeps its watch stable, switches destination and rejects late responses", async () => {
  const originalFetch = globalThis.fetch;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalWindow = globalThis.window;
  const originalNow = Date.now;
  let time = originalNow(),
    receive,
    watches = 0,
    clears = 0,
    state,
    renderer;
  Date.now = () => time;
  const calls = [];
  globalThis.window = globalThis;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      geolocation: {
        watchPosition(callback) {
          receive = callback;
          return ++watches;
        },
        clearWatch() {
          clears++;
        },
      },
    },
  });
  const response = () => ({
    ok: true,
    json: async () => ({
      code: "Ok",
      waypoints: [{ distance: 1 }, { distance: 2 }],
      routes: [
        {
          distance: 1000,
          duration: 120,
          geometry: {
            coordinates: [
              [76, 11],
              [76.01, 11],
            ],
          },
          legs: [{ steps: [] }],
        },
      ],
    }),
  });
  globalThis.fetch = (url, options) =>
    new Promise((resolve) =>
      calls.push({ url, signal: options.signal, resolve: () => resolve(response()) }),
    );
  const props = {
    enabled: true,
    assignmentId: "a",
    assignmentStatus: "accepted",
    vendorLocation: { lat: 11, lng: 76.01 },
    customerLocation: { lat: 11, lng: 76.02 },
    vendorLabel: "Shop",
    customerLabel: "Customer",
  };
  function Probe(p) {
    state = useDriverNavigation(p);
    return null;
  }
  const fix = (accuracy) => ({
    timestamp: time,
    coords: { latitude: 11, longitude: 76, accuracy, heading: 0, speed: 0 },
  });
  try {
    await act(async () => {
      renderer = create(React.createElement(Probe, props));
    });
    assert.equal(watches, 1);
    assert.equal(calls.length, 0);
    assert.equal(state.route, null);
    await act(async () => receive(fix(2000)));
    assert.equal(calls.length, 0);
    assert.match(state.error, /precise/);
    await act(async () => receive(fix(10)));
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /76,11;76.01,11/);
    await act(async () => calls[0].resolve());
    assert.equal(state.route.phase, "to_vendor");
    assert.equal(watches, 1);
    time += 1000;
    await act(async () => receive(fix(10)));
    assert.equal(watches, 1);
    assert.equal(calls.length, 1);
    await act(async () =>
      renderer.update(React.createElement(Probe, { ...props, assignmentStatus: "picked_up" })),
    );
    assert.equal(calls.length, 2);
    assert.equal(state.route, null);
    assert.equal(watches, 1);
    assert.match(calls[1].url, /76,11;76.02,11/);
    await act(async () =>
      renderer.update(
        React.createElement(Probe, {
          ...props,
          assignmentStatus: "picked_up",
          customerLocation: { lat: 11, lng: 76.03 },
        }),
      ),
    );
    assert.equal(calls[1].signal.aborted, true);
    await act(async () => calls[2].resolve());
    const latest = state.route;
    await act(async () => calls[1].resolve());
    assert.equal(state.route, latest);
    assert.equal(state.destination.lng, 76.03);
    globalThis.fetch = async () => {
      throw new Error("routing offline");
    };
    await act(async () => state.forceRefreshRoute());
    assert.equal(state.route, null);
    assert.match(state.error, /routing offline/);
    time += 1000;
    await act(async () => receive(fix(10)));
    assert.match(state.error, /routing offline/);
    await act(async () => renderer.unmount());
    assert.equal(clears, 1);
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else delete globalThis.navigator;
  }
});

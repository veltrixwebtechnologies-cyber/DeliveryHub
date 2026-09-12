import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import React from "react";
import { create, act } from "react-test-renderer";
import { sourceLoader } from "./load-source.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { usableGPS, MAX_LOCATION_AGE_MS } = await sourceLoader(process.cwd())(
  "src/lib/coordinates.ts",
);

test("dashboard rejects coarse GPS, never writes directly, and expires the measured position", async (t) => {
  // Execute the real card's state/effects; replace only its presentation with observable state.
  const source = fs.readFileSync("src/routes/partner.index.tsx", "utf8");
  const start = source.indexOf("function LiveLocationCard(");
  const end = source.indexOf("  return (\n    <Card", start);
  assert.ok(start >= 0 && end > start);
  const code = ts.transpileModule(
    source.slice(start, end) + "return {location,status,updatedAt}; }",
    {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    },
  ).outputText;
  let receive,
    state,
    renderer,
    writes = 0,
    stops = 0;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { geolocation: {} },
  });
  t.mock.method(globalThis, "fetch", async () => ({ ok: false }));
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const card = new Function(
    "useState",
    "useEffect",
    "watchGPS",
    "usableGPS",
    "MAX_LOCATION_AGE_MS",
    "supabase",
    code + "; return LiveLocationCard;",
  )(
    React.useState,
    React.useEffect,
    (callback) => {
      receive = callback;
      return () => stops++;
    },
    usableGPS,
    MAX_LOCATION_AGE_MS,
    {
      from() {
        writes++;
        throw new Error("No direct location writes permitted");
      },
    },
  );
  function Probe() {
    state = card({
      partner: {
        id: "driver",
        availability: "online",
        current_latitude: 11,
        current_longitude: 76,
      },
    });
    return null;
  }
  const fix = (accuracy) => ({
    timestamp: Date.now(),
    coords: { latitude: 9.9816, longitude: 76.2999, accuracy },
  });
  try {
    await act(async () => {
      renderer = create(React.createElement(Probe));
    });
    assert.equal(state.location, null, "stored coordinates must not masquerade as measured GPS");
    await act(async () => receive(fix(50)));
    assert.equal(state.location, null);
    await act(async () => receive(fix(12)));
    assert.deepEqual(state.location, { lat: 9.9816, lng: 76.2999 });
    assert.equal(writes, 0);
    await act(async () => t.mock.timers.tick(30001));
    assert.equal(state.location, null);
    assert.match(state.status, /expired/);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else delete globalThis.navigator;
  }
  assert.equal(stops, 1);
});

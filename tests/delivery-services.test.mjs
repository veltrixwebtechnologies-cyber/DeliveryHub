import test from "node:test";
import assert from "node:assert/strict";
import { sourceLoader } from "./load-source.mjs";

test("delivery actions retain existing RPC names, assignment identity and error propagation", async () => {
  const calls = [];
  globalThis.__deliveryAudit = {
    async rpc(name, payload) {
      calls.push([name, payload]);
      return { data: "accepted", error: null };
    },
  };
  try {
    const load = sourceLoader(process.cwd(), {
      "@/integrations/supabase/client":
        "export const supabase={rpc:(...args)=>globalThis.__deliveryAudit.rpc(...args)};",
    });
    const actions = await load("src/modules/delivery/services/deliveryService.ts");
    assert.equal(await actions.acceptDelivery("assignment-1"), "accepted");
    await actions.rejectDelivery("assignment-2");
    await actions.claimNextDeliveryOffer();
    await actions.goOffline();
    assert.deepEqual(calls, [
      ["accept_delivery_request", { _assignment_id: "assignment-1" }],
      ["reject_delivery_request", { _assignment_id: "assignment-2" }],
      ["claim_next_delivery_offer", undefined],
      ["partner_go_offline", undefined],
    ]);
    globalThis.__deliveryAudit.rpc = async () => ({ error: new Error("Denied by backend") });
    await assert.rejects(actions.acceptDelivery("other-assignment"), /Denied by backend/);
  } finally {
    delete globalThis.__deliveryAudit;
  }
});

test("dashboard repository remains user-scoped and excludes KYC/bank secrets", async () => {
  const calls = [];
  const query = {
    select(value) {
      calls.push(["select", value]);
      return this;
    },
    eq(...args) {
      calls.push(["eq", ...args]);
      return this;
    },
    async maybeSingle() {
      return { data: { id: "partner-1" }, error: null };
    },
  };
  globalThis.__partnerAudit = {
    from(name) {
      calls.push(["from", name]);
      return query;
    },
  };
  try {
    const load = sourceLoader(process.cwd(), {
      "@/integrations/supabase/client":
        "export const supabase={from:(...args)=>globalThis.__partnerAudit.from(...args)};",
    });
    const repository = await load("src/modules/delivery/repositories/partnerRepository.ts");
    assert.deepEqual(await repository.getPartnerForDashboard("user-1"), { id: "partner-1" });
    assert.deepEqual(calls[0], ["from", "delivery_partners"]);
    assert.deepEqual(calls[2], ["eq", "user_id", "user-1"]);
    assert.doesNotMatch(
      repository.SAFE_PARTNER_SELECT,
      /aadhaar|pan_number|bank_account|bank_ifsc/,
    );
  } finally {
    delete globalThis.__partnerAudit;
  }
});

test("shared order adapter preserves store pickup and customer coordinate order", async () => {
  const { normalizeAssignment } = await sourceLoader(process.cwd())("src/shared/orders/adapter.ts");
  const row = normalizeAssignment({
    id: "assignment-1",
    orders: {
      id: "order-1",
      order_number: "LS-1",
      customer_latitude: 11.01,
      customer_longitude: 77.02,
      seller: { business_name: "Seller", lat: 10.9, lng: 76.9 },
      delivery_assignments: [
        {
          id: "assignment-1",
          status: "accepted",
          pickup_latitude: 11.02,
          pickup_longitude: 77.03,
          pickup_store_name: "Selected store",
        },
      ],
      order_items: [{ product_name: "Item", quantity: 2 }],
    },
  });
  assert.equal(row.orders.id, "order-1");
  assert.equal(row.orders.vendors.lat, 11.02);
  assert.equal(row.orders.vendors.lng, 77.03);
  assert.equal(row.orders.vendors.shop_name, "Selected store");
  assert.equal(row.orders.customer_latitude, 11.01);
  assert.equal(row.orders.customer_longitude, 77.02);
  assert.equal(row.orders.items[0].name, "Item");
});

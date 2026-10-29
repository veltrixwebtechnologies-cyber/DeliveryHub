import { initialLocalData, type LocalStoreSchema } from "./initialData";

const DB_KEY = "localshore_db_store_v1";

export function getLocalDb(): LocalStoreSchema {
  if (typeof window === "undefined") {
    return initialLocalData;
  }
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      localStorage.setItem(DB_KEY, JSON.stringify(initialLocalData));
      return initialLocalData;
    }
    const parsed = JSON.parse(raw);
    // Ensure all tables exist
    for (const key of Object.keys(initialLocalData)) {
      if (!parsed[key]) {
        parsed[key] = (initialLocalData as any)[key] || [];
      }
    }
    return parsed;
  } catch (err) {
    console.error("[LocalDB] Error reading storage:", err);
    return initialLocalData;
  }
}

export function saveLocalDb(db: LocalStoreSchema) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (err) {
    console.error("[LocalDB] Error saving storage:", err);
  }
}

export function resetLocalDb() {
  if (typeof window === "undefined") return;
  localStorage.setItem(DB_KEY, JSON.stringify(initialLocalData));
}

function resolveRelationship(
  item: Record<string, any>,
  fieldSelect: string,
  currentDb: LocalStoreSchema,
) {
  // Pattern 1: orders(...) or orders(order_code, total)
  // Pattern 2: seller:sellers(...)
  // Pattern 3: delivery_partners(...)
  const relMatch = fieldSelect.match(/^([a-zA-Z0-9_]+)(?::([a-zA-Z0-9_]+))?\((.*)\)$/);
  if (!relMatch) return null;

  const alias = relMatch[2] ? relMatch[1] : null;
  const targetTable = relMatch[2] || relMatch[1];
  const subFields = relMatch[3];

  let relatedData: any = null;

  if (targetTable === "orders" && item.order_id) {
    const order = (currentDb.orders || []).find((o) => o.id === item.order_id);
    if (order) {
      const orderCopy = { ...order };
      if (subFields.includes("order_items")) {
        (orderCopy as any).order_items = (currentDb.order_items || []).filter(
          (oi) => oi.order_id === order.id,
        );
      }
      if (subFields.includes("seller")) {
        (orderCopy as any).seller = (currentDb.sellers || []).find(
          (s) => s.id === order.seller_id,
        ) || null;
      }
      relatedData = orderCopy;
    }
  } else if (targetTable === "sellers" && item.seller_id) {
    relatedData = (currentDb.sellers || []).find((s) => s.id === item.seller_id) || null;
  } else if (targetTable === "delivery_partners" && item.partner_id) {
    relatedData = (currentDb.delivery_partners || []).find((p) => p.id === item.partner_id) || null;
  } else if (targetTable === "delivery_assignments" && item.id) {
    relatedData = (currentDb.delivery_assignments || []).filter((a) => a.order_id === item.id);
  }

  return { key: alias || targetTable, data: relatedData };
}

export class LocalQueryBuilder {
  private tableName: string;
  private operation: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private payload: any = null;
  private upsertOptions?: { onConflict?: string };
  private filters: Array<(row: any) => boolean> = [];
  private orderConfig: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;
  private selectedColumns: string | null = null;
  private isSingle = false;
  private isMaybeSingle = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns = "*") {
    this.selectedColumns = columns;
    return this;
  }

  insert(data: any | any[]) {
    this.operation = "insert";
    this.payload = data;
    return this;
  }

  upsert(data: any | any[], options?: { onConflict?: string }) {
    this.operation = "upsert";
    this.payload = data;
    this.upsertOptions = options;
    return this;
  }

  update(patch: Record<string, any>) {
    this.operation = "update";
    this.payload = patch;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  not(column: string, operator: string, value: any) {
    if (operator === "in") {
      let list: any[] = [];
      if (typeof value === "string" && value.startsWith("(") && value.endsWith(")")) {
        list = value
          .slice(1, -1)
          .split(",")
          .map((v) => v.trim().replace(/^['"]|['"]$/g, ""));
      } else if (Array.isArray(value)) {
        list = value;
      }
      this.filters.push((row) => !list.includes(row[column]));
    } else {
      this.filters.push((row) => row[column] !== value);
    }
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push((row) => row[column] > value);
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push((row) => row[column] >= value);
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push((row) => row[column] < value);
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push((row) => row[column] <= value);
    return this;
  }

  like(column: string, pattern: string) {
    const regex = new RegExp("^" + pattern.replace(/%/g, ".*") + "$");
    this.filters.push((row) => regex.test(String(row[column] ?? "")));
    return this;
  }

  ilike(column: string, pattern: string) {
    const regex = new RegExp("^" + pattern.replace(/%/g, ".*") + "$", "i");
    this.filters.push((row) => regex.test(String(row[column] ?? "")));
    return this;
  }

  order(column: string, options: { ascending?: boolean } = { ascending: true }) {
    this.orderConfig = { column, ascending: options.ascending ?? true };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  then(resolve: (val: any) => any, reject?: (err: any) => any) {
    return this.execute().then(resolve, reject);
  }

  private async execute(): Promise<{ data: any; error: any }> {
    const db = getLocalDb();
    const table = (db as any)[this.tableName] || [];

    // 1. INSERT OPERATION
    if (this.operation === "insert") {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted: any[] = [];
      for (const item of items) {
        const newRow = {
          id: item.id || `gen-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          created_at: item.created_at || new Date().toISOString(),
          updated_at: item.updated_at || new Date().toISOString(),
          ...item,
        };
        table.push(newRow);
        inserted.push(newRow);
      }
      (db as any)[this.tableName] = table;
      saveLocalDb(db);
      const res = Array.isArray(this.payload)
        ? inserted
        : this.isSingle || this.isMaybeSingle || !Array.isArray(this.payload)
          ? inserted[0]
          : inserted;
      return { data: res, error: null };
    }

    // 2. UPSERT OPERATION
    if (this.operation === "upsert") {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const conflictKeys = this.upsertOptions?.onConflict
        ? this.upsertOptions.onConflict.split(",").map((k) => k.trim())
        : ["id"];
      const upserted: any[] = [];
      for (const item of items) {
        const existingIdx = table.findIndex((row: any) =>
          conflictKeys.every((k) => row[k] === item[k]),
        );
        if (existingIdx >= 0) {
          table[existingIdx] = {
            ...table[existingIdx],
            ...item,
            updated_at: new Date().toISOString(),
          };
          upserted.push(table[existingIdx]);
        } else {
          const newRow = {
            id: item.id || `gen-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString(),
            ...item,
          };
          table.push(newRow);
          upserted.push(newRow);
        }
      }
      (db as any)[this.tableName] = table;
      saveLocalDb(db);
      const res = Array.isArray(this.payload)
        ? upserted
        : this.isSingle || this.isMaybeSingle || !Array.isArray(this.payload)
          ? upserted[0]
          : upserted;
      return { data: res, error: null };
    }

    // 3. UPDATE OPERATION
    if (this.operation === "update") {
      const updated: any[] = [];
      for (let i = 0; i < table.length; i++) {
        if (this.filters.every((fn) => fn(table[i]))) {
          table[i] = {
            ...table[i],
            ...this.payload,
            updated_at: new Date().toISOString(),
          };
          updated.push(table[i]);
        }
      }
      (db as any)[this.tableName] = table;
      saveLocalDb(db);
      const res = this.isSingle || this.isMaybeSingle ? (updated[0] ?? null) : updated;
      return { data: res, error: null };
    }

    // 4. DELETE OPERATION
    if (this.operation === "delete") {
      const remaining = table.filter((row: any) => !this.filters.every((fn) => fn(row)));
      (db as any)[this.tableName] = remaining;
      saveLocalDb(db);
      return { data: null, error: null };
    }

    // 5. SELECT OPERATION
    let filtered = table.filter((row: any) => this.filters.every((fn) => fn(row)));

    if (this.orderConfig) {
      const { column, ascending } = this.orderConfig;
      filtered.sort((a: any, b: any) => {
        const valA = a[column];
        const valB = b[column];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return ascending ? 1 : -1;
        if (valB === null || valB === undefined) return ascending ? -1 : 1;
        return ascending ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
      });
    }

    if (this.limitCount !== null) {
      filtered = filtered.slice(0, this.limitCount);
    }

    // Process select & relationship expansions
    if (this.selectedColumns && this.selectedColumns !== "*") {
      filtered = filtered.map((item: any) => {
        const result: Record<string, any> = {};
        const parts = this.selectedColumns!.split(",").map((p) => p.trim());
        for (const part of parts) {
          if (part.includes("(")) {
            const rel = resolveRelationship(item, part, db);
            if (rel) {
              result[rel.key] = rel.data;
            }
          } else if (item[part] !== undefined) {
            result[part] = item[part];
          }
        }
        return { ...item, ...result };
      });
    }

    if (this.isSingle) {
      if (filtered.length === 0) {
        return { data: null, error: new Error("Row not found") };
      }
      return { data: filtered[0], error: null };
    }

    if (this.isMaybeSingle) {
      return { data: filtered.length > 0 ? filtered[0] : null, error: null };
    }

    return { data: filtered, error: null };
  }
}

export const localDb = {
  from: (table: string) => new LocalQueryBuilder(table),

  rpc: async (functionName: string, args: Record<string, any> = {}) => {
    const db = getLocalDb();

    switch (functionName) {
      case "has_admin_permission": {
        return { data: true, error: null };
      }

      case "submit_partner_location": {
        const { _latitude, _longitude } = args;
        return { data: { success: true, lat: _latitude, lng: _longitude }, error: null };
      }

      case "update_delivery_location": {
        return { data: { success: true }, error: null };
      }

      case "accept_delivery_request": {
        const { _assignment_id } = args;
        const assignment = (db.delivery_assignments || []).find((a) => a.id === _assignment_id);
        if (assignment) {
          assignment.status = "accepted";
          assignment.responded_at = new Date().toISOString();
          saveLocalDb(db);
        }
        return { data: { success: true, status: "accepted" }, error: null };
      }

      case "reject_delivery_request": {
        const { _assignment_id } = args;
        const assignment = (db.delivery_assignments || []).find((a) => a.id === _assignment_id);
        if (assignment) {
          assignment.status = "rejected";
          assignment.responded_at = new Date().toISOString();
          saveLocalDb(db);
        }
        return { data: { success: true, status: "rejected" }, error: null };
      }

      case "advance_delivery_assignment": {
        const { _assignment_id, _target_status } = args;
        const assignment = (db.delivery_assignments || []).find((a) => a.id === _assignment_id);
        if (assignment) {
          assignment.status = _target_status;
          if (_target_status === "picked_up") {
            assignment.picked_up_at = new Date().toISOString();
          }
          saveLocalDb(db);
        }
        return { data: { success: true, status: _target_status }, error: null };
      }

      case "complete_delivery": {
        const { _assignment_id, _otp, _proof_url } = args;
        const assignment = (db.delivery_assignments || []).find((a) => a.id === _assignment_id);
        if (assignment) {
          assignment.status = "delivered";
          assignment.delivered_at = new Date().toISOString();
          assignment.proof_type = _proof_url ? "photo" : "otp";
          assignment.proof_value = _proof_url || _otp || "verified";

          // Add earning
          db.delivery_earnings.push({
            id: `earn-${Date.now()}`,
            partner_id: assignment.partner_id,
            assignment_id: assignment.id,
            amount: assignment.estimated_earning || 65,
            type: "delivery_fee",
            description: "Delivery fee for completed order",
            payout_id: null,
            created_at: new Date().toISOString(),
          });

          saveLocalDb(db);
        }
        return { data: { success: true, status: "delivered" }, error: null };
      }

      case "advance_seller_order": {
        const { _order_id, _target_status } = args;
        const order = (db.orders || []).find((o) => o.id === _order_id);
        if (order) {
          order.status = _target_status;
          saveLocalDb(db);
        }
        return { data: { success: true }, error: null };
      }

      case "create_seller_promotion": {
        const newPromo = {
          id: `promo-${Date.now()}`,
          seller_id: args._seller_id || "seller-001",
          code: args._code,
          discount_type: args._discount_type,
          discount_value: args._discount_value,
          is_active: true,
          start_date: args._start_date,
          end_date: args._end_date,
          usage_limit: args._usage_limit || null,
          created_at: new Date().toISOString(),
        };
        db.promotions.push(newPromo);
        saveLocalDb(db);
        return { data: newPromo, error: null };
      }

      case "toggle_seller_promotion": {
        const promo = db.promotions.find((p) => p.id === args._promotion_id);
        if (promo) {
          promo.is_active = args._active;
          saveLocalDb(db);
        }
        return { data: promo, error: null };
      }

      case "queue_seller_export": {
        const exportItem = {
          id: `exp-${Date.now()}`,
          seller_id: args._seller_id || "seller-001",
          type: args._type,
          format: args._format,
          status: "completed",
          created_at: new Date().toISOString(),
        };
        db.seller_exports.push(exportItem);
        saveLocalDb(db);
        return { data: exportItem, error: null };
      }

      case "partner_go_offline": {
        for (const p of db.delivery_partners || []) {
          p.availability = "offline";
        }
        saveLocalDb(db);
        return { data: { success: true }, error: null };
      }

      case "sync_partner_zone_to_current_location": {
        const { _partner_id, _lat, _lng } = args;
        const partner = (db.delivery_partners || []).find((p) => p.id === _partner_id);
        if (partner && _lat && _lng) {
          partner.current_latitude = _lat;
          partner.current_longitude = _lng;
          partner.location_updated_at = new Date().toISOString();
          saveLocalDb(db);
        }
        return { data: { success: true }, error: null };
      }

      case "claim_next_delivery_offer": {
        // Find ready orders and assign to online partner
        const readyOrder = (db.orders || []).find((o) => o.status === "ready_for_pickup");
        const onlinePartner = (db.delivery_partners || []).find((p) => p.availability === "online");
        if (readyOrder && onlinePartner) {
          const existing = (db.delivery_assignments || []).find(
            (a) => a.order_id === readyOrder.id && ["pending", "accepted"].includes(a.status),
          );
          if (!existing) {
            db.delivery_assignments.push({
              id: `assign-${Date.now()}`,
              order_id: readyOrder.id,
              partner_id: onlinePartner.id,
              status: "pending",
              distance_km: 2.5,
              estimated_earning: readyOrder.estimated_delivery_fee || 65,
              proof_type: null,
              proof_value: null,
              picked_up_at: null,
              delivered_at: null,
              responded_at: null,
              expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            saveLocalDb(db);
          }
        }
        return { data: { success: true }, error: null };
      }

      default:
        console.warn(`[LocalDB] Unhandled RPC: ${functionName}`, args);
        return { data: { success: true }, error: null };
    }
  },

  storage: {
    from: (bucket: string) => ({
      upload: async (path: string, file: File | Blob) => {
        // Mock upload: save object URL in memory / storage
        const url = URL.createObjectURL(file);
        return { data: { path, url }, error: null };
      },
      createSignedUrl: async (path: string) => {
        return {
          data: {
            signedUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80",
          },
          error: null,
        };
      },
      getPublicUrl: (path: string) => {
        return {
          data: {
            publicUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80",
          },
        };
      },
    }),
  },
};

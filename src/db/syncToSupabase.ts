import { getLocalDb } from "./localStorageDb";
import { supabase as liveSupabase } from "@/integrations/supabase/client";

export interface SyncReport {
  timestamp: string;
  tables: Record<string, { total: number; synced: number; error?: string }>;
  success: boolean;
}

/**
 * Pushes all locally accumulated tables directly to the active Supabase project.
 * Uses upserts to prevent duplicate errors or data corruption.
 */
export async function pushLocalDbToSupabase(): Promise<SyncReport> {
  const local = getLocalDb();
  const report: SyncReport = {
    timestamp: new Date().toISOString(),
    tables: {},
    success: true,
  };

  const syncOrder: Array<keyof typeof local> = [
    "delivery_zones",
    "delivery_shifts",
    "delivery_partners",
    "delivery_partner_zones",
    "sellers",
    "orders",
    "order_items",
    "delivery_assignments",
    "delivery_documents",
    "delivery_earnings",
    "delivery_payouts",
    "delivery_notifications",
    "products",
    "product_variants",
    "promotions",
    "returns",
    "customer_metrics",
    "seller_settlements",
    "user_roles",
  ];

  console.info("[Supabase Sync] Starting sync of local database to Supabase Cloud...");

  for (const table of syncOrder) {
    const rows = (local as any)[table] || [];
    if (rows.length === 0) {
      report.tables[table] = { total: 0, synced: 0 };
      continue;
    }

    try {
      // Clean rows for Supabase schema (remove non-db fields)
      const cleanRows = rows.map((row: any) => {
        const copy = { ...row };
        // Delete client-side expanded relationship properties before inserting
        delete copy.seller;
        delete copy.orders;
        delete copy.delivery_partners;
        delete copy.order_items;
        delete copy.password;
        return copy;
      });

      const { data, error } = await liveSupabase
        .from(table as any)
        .upsert(cleanRows as any, { onConflict: "id" } as any);

      if (error) {
        console.warn(`[Supabase Sync] Failed to sync ${table}:`, error.message);
        report.tables[table] = { total: rows.length, synced: 0, error: error.message };
        report.success = false;
      } else {
        console.info(`[Supabase Sync] Successfully synced ${cleanRows.length} rows to ${table}`);
        report.tables[table] = { total: rows.length, synced: cleanRows.length };
      }
    } catch (err: any) {
      console.error(`[Supabase Sync] Exception syncing ${table}:`, err);
      report.tables[table] = { total: rows.length, synced: 0, error: err?.message || String(err) };
      report.success = false;
    }
  }

  return report;
}

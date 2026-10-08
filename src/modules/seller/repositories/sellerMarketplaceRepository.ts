import { db } from "@/lib/db";
import type {
  CreatePromotionInput,
  CreateVariantInput,
  CustomerMetric,
  ProductVariant,
  Promotion,
  SellerExport,
  SellerProduct,
  SellerReturn,
  Settlement,
} from "@/types/sellerModules";

const pageSize = 25;

export async function listProducts(sellerId: string, cursor?: string) {
  let query = db
    .from("products")
    .select("*")
    .eq("seller_id", sellerId)
    .order("updated_at", { ascending: false })
    .limit(pageSize);
  if (cursor) query = query.lt("updated_at", cursor);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SellerProduct[];
}

export async function listVariants(productId: string) {
  const { data, error } = await db
    .from("product_variants")
    .select("*")
    .eq("product_id", productId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as ProductVariant[];
}

export async function createVariant(input: CreateVariantInput) {
  const { data, error } = await db.from("product_variants").insert(input).select("*").single();
  if (error) throw error;
  return data as ProductVariant;
}

export async function updateVariant(id: string, patch: Partial<CreateVariantInput>) {
  const { data, error } = await db
    .from("product_variants")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductVariant;
}

export async function deleteVariant(id: string) {
  const { error } = await db.from("product_variants").delete().eq("id", id);
  if (error) throw error;
}

export async function listReturns(sellerId: string, status?: string) {
  let query = db
    .from("returns")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(pageSize);
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SellerReturn[];
}

export async function updateReturn(id: string, status: string, notes?: string | null) {
  const { data, error } = await db.rpc("set_return_status", {
    _return_id: id,
    _status: status,
    _notes: notes ?? null,
  });
  if (error) throw error;
  return data as SellerReturn;
}

export async function listPromotions(sellerId: string) {
  const { data, error } = await db
    .from("promotions")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Promotion[];
}

export async function createPromotion(input: CreatePromotionInput) {
  const { data, error } = await db.rpc("create_seller_promotion", {
    _code: input.code,
    _discount_type: input.discountType,
    _discount_value: input.discountValue,
    _start_date: input.startDate,
    _end_date: input.endDate,
    _usage_limit: input.usageLimit ?? null,
  });
  if (error) throw error;
  return data as Promotion;
}

export async function togglePromotion(id: string, active: boolean) {
  const { data, error } = await db.rpc("toggle_seller_promotion", {
    _promotion_id: id,
    _active: active,
  });
  if (error) throw error;
  return data as Promotion;
}

export async function deletePromotion(id: string) {
  const { error } = await db.from("promotions").delete().eq("id", id);
  if (error) throw error;
}

export async function listCustomerMetrics(sellerId: string) {
  const { data, error } = await db
    .from("customer_metrics")
    .select("*")
    .eq("seller_id", sellerId)
    .order("total_spend", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as CustomerMetric[];
}

export async function listSettlements(sellerId: string) {
  const { data, error } = await db
    .from("seller_settlements")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as Settlement[];
}

export async function queueExport(type: string, format: string, filters: Record<string, unknown>) {
  const { data, error } = await db.rpc("queue_seller_export", {
    _type: type,
    _format: format,
    _filters: filters,
  });
  if (error) throw error;
  return data as SellerExport;
}

export async function listExports(sellerId: string) {
  const { data, error } = await db
    .from("seller_exports")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as SellerExport[];
}

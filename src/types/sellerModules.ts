export type ProductStatus = "draft" | "published" | "archived";
export type ReturnStatus = "requested" | "under_review" | "approved" | "rejected" | "refunded";
export type PromotionType = "percentage" | "flat" | "bogo" | "free_shipping";
export type SettlementStatus = "pending" | "processing" | "paid" | "failed";
export type ExportType =
  "orders" | "products" | "inventory" | "settlements" | "reviews" | "returns";
export type ExportFormat = "csv" | "xlsx" | "pdf";

export type SellerProduct = {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  status: ProductStatus;
  category: string | null;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductVariant = {
  id: string;
  product_id: string;
  sku: string;
  barcode: string | null;
  price: number;
  sale_price: number | null;
  stock: number;
  weight: number | null;
  image_url: string | null;
  attributes: Record<string, string>;
  created_at: string;
  updated_at: string;
};

export type SellerReturn = {
  id: string;
  order_id: string;
  seller_id: string;
  reason: string;
  status: ReturnStatus;
  notes: string | null;
  images: string[];
  refund_amount: number | null;
  created_at: string;
  updated_at: string;
};

export type Promotion = {
  id: string;
  seller_id: string;
  code: string;
  discount_type: PromotionType;
  discount_value: number | null;
  start_date: string;
  end_date: string;
  usage_limit: number | null;
  usage_count: number;
  revenue_generated: number;
  active: boolean;
  created_at: string;
};

export type CustomerMetric = {
  id: string;
  seller_id: string;
  customer_id: string;
  total_orders: number;
  total_spend: number;
  first_order_at: string | null;
  last_order_at: string | null;
  updated_at: string;
};

export type Settlement = {
  id: string;
  seller_id: string;
  amount: number;
  status: SettlementStatus;
  payout_date: string | null;
  transaction_reference: string | null;
  notes: string | null;
  created_at: string;
};

export type SellerExport = {
  id: string;
  seller_id: string;
  export_type: ExportType;
  format: ExportFormat;
  filters: Record<string, unknown>;
  status: "queued" | "processing" | "ready" | "failed";
  file_path: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

export type CreateVariantInput = Omit<
  Pick<
    ProductVariant,
    | "product_id"
    | "sku"
    | "barcode"
    | "price"
    | "sale_price"
    | "stock"
    | "weight"
    | "image_url"
    | "attributes"
  >,
  never
>;
export type CreatePromotionInput = {
  code: string;
  discountType: PromotionType;
  discountValue: number;
  startDate: string;
  endDate: string;
  usageLimit?: number | null;
};

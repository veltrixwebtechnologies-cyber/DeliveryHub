import { z } from "zod";
import {
  createPromotion as createPromotionRecord,
  createVariant as createVariantRecord,
  deletePromotion,
  deleteVariant,
  togglePromotion,
  updateReturn,
  updateVariant,
} from "@/repositories/sellerMarketplaceRepository";
import type {
  CreatePromotionInput,
  CreateVariantInput,
  PromotionType,
} from "@/types/sellerModules";

const variantSchema = z.object({
  product_id: z.string().uuid(),
  sku: z.string().trim().min(2).max(64),
  barcode: z.string().trim().max(64).nullable(),
  price: z.number().nonnegative(),
  sale_price: z.number().nonnegative().nullable(),
  stock: z.number().int().nonnegative(),
  weight: z.number().nonnegative().nullable(),
  image_url: z.string().url().nullable(),
  attributes: z.record(z.string()),
});

const promotionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/),
  discountType: z.enum(["percentage", "flat", "bogo", "free_shipping"]),
  discountValue: z.number().nonnegative(),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }),
  usageLimit: z.number().int().positive().nullable().optional(),
});

export async function createVariant(input: CreateVariantInput) {
  return createVariantRecord(variantSchema.parse(input));
}

export async function editVariant(id: string, patch: Partial<CreateVariantInput>) {
  return updateVariant(id, patch);
}

export { deleteVariant, updateReturn, togglePromotion, deletePromotion };

export async function createPromotion(input: CreatePromotionInput) {
  const value = promotionSchema.parse(input);
  if (new Date(value.endDate) <= new Date(value.startDate))
    throw new Error("End date must be after start date.");
  return createPromotionRecord({ ...value, usageLimit: value.usageLimit ?? null });
}

export type { PromotionType };

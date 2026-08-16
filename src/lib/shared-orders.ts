/* eslint-disable @typescript-eslint/no-explicit-any -- normalizes legacy and current marketplace row shapes. */
/**
 * The customer and seller apps use the shared marketplace schema:
 * orders.seller_id, order_number, buyer_* and order_items. The delivery UI
 * keeps its existing display model, so all schema translation lives here.
 */
export function normalizeOrder(row: any) {
  const seller = row?.seller ?? row?.vendors ?? null;
  const address = [
    seller?.address_line1,
    seller?.address_line2,
    seller?.city,
    seller?.state,
    seller?.pincode,
  ]
    .filter(Boolean)
    .join(", ");
  return {
    ...row,
    order_code: row?.order_code ?? row?.order_number,
    customer_name: row?.customer_name ?? row?.buyer_name,
    customer_phone: row?.customer_phone ?? row?.buyer_phone,
    customer_address: row?.customer_address ?? row?.buyer_address,
    order_total: row?.order_total ?? row?.total,
    delivery_fee: row?.delivery_fee ?? row?.shipping_fee,
    items:
      row?.items ??
      (row?.order_items ?? []).map((item: any) => ({
        ...item,
        name: item.product_name,
      })),
    vendors: seller
      ? {
          ...seller,
          shop_name: seller.shop_name ?? seller.business_name,
          address: seller.address ?? address,
          phone: seller.phone,
        }
      : null,
  };
}

export function normalizeAssignment(row: any) {
  return row ? { ...row, orders: normalizeOrder(row.orders) } : row;
}

export const DELIVERY_ORDER_SELECT = "*, seller:sellers(*), order_items(*)";

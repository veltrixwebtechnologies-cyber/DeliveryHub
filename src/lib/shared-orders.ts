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

  const activeAssignment = Array.isArray(row?.delivery_assignments)
    ? (row?.delivery_assignments.find((a: any) => a.status !== "expired" && a.status !== "rejected") ?? row?.delivery_assignments[0])
    : row?.delivery_assignments ?? null;

  const partnerRow = row?.assigned_partner ?? activeAssignment?.delivery_partners ?? null;
  const assigned_partner = partnerRow
    ? {
        id: partnerRow.id,
        full_name: partnerRow.full_name ?? partnerRow.name ?? "Delivery Partner",
        mobile: partnerRow.mobile ?? partnerRow.phone ?? "",
        status: partnerRow.status ?? "approved",
        vehicle_type: partnerRow.vehicle_type ?? "Motorbike",
        vehicle_number: partnerRow.vehicle_number ?? "",
        rating: partnerRow.rating ? Number(partnerRow.rating) : 4.9,
      }
    : null;

  return {
    ...row,
    order_code: row?.order_code ?? row?.order_number,
    customer_name: row?.customer_name ?? row?.buyer_name,
    customer_phone: row?.customer_phone ?? row?.buyer_phone,
    customer_address: row?.customer_address ?? row?.buyer_address,
    order_total: row?.order_total ?? row?.total,
    delivery_fee: row?.delivery_fee ?? row?.shipping_fee,
    assigned_partner,
    delivery_assignment: activeAssignment,
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

export const DELIVERY_ORDER_SELECT =
  "*, seller:sellers(*), order_items(*), delivery_assignments(*, delivery_partners(*))";


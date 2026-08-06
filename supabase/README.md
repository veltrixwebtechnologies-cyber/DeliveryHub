# Shared Supabase migrations

The Delivery Partner Hub uses the existing LocalShoree/SellerHub database. The
canonical `public.orders` table and order RPCs live under
`SellerHub/supabase/migrations`.

Apply migrations from `SellerHub/supabase/migrations` in timestamp order,
including:

1. `20260801085900_delivery_partner_enum_values.sql`
2. `20260801090000_delivery_partner_shared_integration.sql`
3. `20260802000000_order_delivery_hardening.sql`

Do **not** run the older Delivery Partner Hub migration files against the shared
project. They contain the original standalone delivery schema, including a
duplicate `public.orders` definition. The Delivery Partner Hub frontend already
uses the canonical `orders`, `order_items`, `sellers`, and delivery tables from
the shared integration migration.

# Delivery Partner Hub migrations

Do not run these legacy migrations against the shared LocalShoree Supabase project.

The production shared database schema is maintained from:

`../SellerHub/supabase/migrations`

Use the SellerHub migrations for the canonical `orders`, `order_items`, delivery assignment, wallet, and payout schema. Some older Delivery Partner Hub migration files were generated before the app was connected to the shared marketplace backend and can conflict with the canonical order schema.

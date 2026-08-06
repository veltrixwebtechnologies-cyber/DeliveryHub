# Delivery Partner Hub

This application is part of the LocalShoree platform and uses the same Supabase project as `ShorelineShopper` and `SellerHub`.

## Shared backend setup

1. Keep `.env` aligned with the other two applications. It must contain the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. Run `SellerHub/supabase/migrations/20260801090000_delivery_partner_shared_integration.sql` once in the existing Supabase SQL Editor.
3. Do not run the old full-schema migrations in this app's `supabase/migrations` directory against the shared project. They belong to the original standalone delivery prototype and would recreate tables that already belong to SellerHub.

The additive SellerHub migration creates only delivery-specific tables, RLS policies, storage rules, and RPCs. Orders, sellers, users, products, and authentication remain shared with the other applications.

# Seller Portal: API and database contract

The current Seller Hub dashboard is implemented in `src/routes/vendor.tsx`.
It consumes the existing `sellers` and `orders` data and keeps the remaining
marketplace modules behind explicit UI actions until their server contracts are
deployed. The browser must never calculate authoritative balances, order
transitions, inventory, refunds, or account-health decisions.

## Recommended component boundary

```text
SellerDashboard
├── SellerSidebar
├── SellerTopbar
├── WelcomeCard
├── HealthCard
├── StatCard[]
├── SalesOverview / OrdersTrend / RevenueTrend
├── RecentOrders
├── InventoryCenter
├── QuickActions
├── AnalyticsSnapshot
├── PaymentsSnapshot
└── NotificationsSnapshot
```

## API-ready services

Create these services under `src/services/` as each module is connected:

```ts
SellerDashboardService.getSummary({ sellerId, range })
SellerOrderService.list({ sellerId, status, search, cursor, limit })
SellerOrderService.advance(orderId, idempotencyKey)
ProductService.list({ sellerId, state, search, cursor, limit })
ProductService.bulkUpdate(productIds, patch, idempotencyKey)
InventoryService.listAlerts({ sellerId, type })
PromotionService.create(input, idempotencyKey)
ReturnService.list({ sellerId, status, cursor, limit })
SettlementService.list({ sellerId, cursor, limit })
ReviewService.list({ sellerId, rating, replied, cursor, limit })
NotificationService.list({ sellerId, unreadOnly, cursor, limit })
```

Mutation endpoints/RPCs must authorize the seller server-side and return the
updated record. All mutations should accept an idempotency key and enforce
ownership through RLS plus database constraints.

## Proposed schema additions

Use internal IDs and keep provider IDs in separate integration columns.

```sql
create table public.seller_products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  title text not null,
  slug text not null,
  description text,
  category_id uuid,
  state text not null default 'draft'
    check (state in ('draft','published','archived')),
  seo_title text,
  seo_description text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, slug)
);

create table public.seller_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.seller_products(id) on delete cascade,
  sku text not null unique,
  option_values jsonb not null default '{}'::jsonb,
  price numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2),
  is_active boolean not null default true
);

create table public.seller_inventory (
  variant_id uuid primary key references public.seller_product_variants(id) on delete cascade,
  available_quantity integer not null default 0 check (available_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  reorder_level integer not null default 5 check (reorder_level >= 0),
  updated_at timestamptz not null default now()
);

create table public.seller_returns (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id),
  order_id uuid not null references public.orders(id),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','refunded')),
  reason text not null,
  refund_amount numeric(12,2),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.seller_promotions (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id),
  code text not null,
  kind text not null check (kind in ('percentage','flat','bogo','free_shipping')),
  value numeric(12,2),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  usage_limit integer,
  is_active boolean not null default true,
  unique (seller_id, code)
);

create table public.seller_reviews (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id),
  order_id uuid references public.orders(id),
  product_id uuid references public.seller_products(id),
  customer_id uuid,
  rating smallint not null check (rating between 1 and 5),
  body text,
  seller_reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.seller_settlements (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id),
  amount numeric(12,2) not null,
  status text not null check (status in ('pending','processing','paid','failed')),
  provider text,
  provider_settlement_id text,
  idempotency_key text not null unique,
  settlement_date timestamptz,
  created_at timestamptz not null default now()
);
```

Add RLS policies that scope every row to the authenticated seller. Keep
financial and return state transitions inside `SECURITY DEFINER` RPCs that
validate ownership, allowed state transitions, and idempotency keys.

## Required dashboard summary RPC

`get_seller_dashboard_summary(_seller_id, _from, _to)` should return one typed
object containing KPI totals, account-health metrics, chart series, inventory
alerts, and settlement totals. This avoids eight independent dashboard queries
on every load. It should use aggregate queries over indexed columns and apply
the seller ownership check internally.

Recommended indexes:

```sql
create index on public.seller_products(seller_id, state, updated_at desc);
create index on public.seller_product_variants(product_id, is_active);
create index on public.seller_returns(seller_id, status, created_at desc);
create index on public.seller_reviews(seller_id, rating, created_at desc);
create index on public.seller_settlements(seller_id, created_at desc);
```

## Current implementation boundary

The dashboard currently uses the existing `advance_seller_order` RPC for the
live order action. Product, inventory, returns, promotions, customer, review,
reports, and settlement controls show API-ready states/toasts until their
server contracts exist; no client-side mutation is presented as authoritative.

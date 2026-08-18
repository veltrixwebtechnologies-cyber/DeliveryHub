  -- Seller Central marketplace modules.
  -- The migration is additive and keeps existing orders/RPCs compatible.

  create table if not exists public.sellers (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique,
    store_name text not null default 'My Store',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  alter table public.sellers add column if not exists store_name text;
  alter table public.sellers add column if not exists updated_at timestamptz default now();
  grant select, insert, update on public.sellers to authenticated;

  create or replace function public.is_my_seller(_seller_id uuid)
  returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.sellers where id = _seller_id and user_id = auth.uid())
  $$;

  create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    seller_id uuid not null references public.sellers(id) on delete cascade,
    name text not null,
    description text,
    status text not null default 'draft' check (status in ('draft','published','archived')),
    category text,
    tags text[] not null default '{}',
    seo_title text,
    seo_description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create table if not exists public.product_variants (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references public.products(id) on delete cascade,
    sku text not null unique,
    barcode text,
    price numeric(12,2) not null check (price >= 0),
    sale_price numeric(12,2) check (sale_price is null or sale_price >= 0),
    stock integer not null default 0 check (stock >= 0),
    weight numeric(12,3),
    image_url text,
    attributes jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  alter table public.product_variants add column if not exists barcode text;
  alter table public.product_variants add column if not exists sale_price numeric(12,2);
  alter table public.product_variants add column if not exists stock integer default 0;
  alter table public.product_variants add column if not exists weight numeric(12,3);
  alter table public.product_variants add column if not exists image_url text;
  alter table public.product_variants add column if not exists attributes jsonb default '{}'::jsonb;

  create table if not exists public.returns (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete cascade,
    seller_id uuid not null references public.sellers(id) on delete cascade,
    reason text not null,
    status text not null default 'requested' check (status in ('requested','under_review','approved','rejected','refunded')),
    notes text,
    images jsonb not null default '[]'::jsonb,
    refund_amount numeric(12,2),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create table if not exists public.promotions (
    id uuid primary key default gen_random_uuid(),
    seller_id uuid not null references public.sellers(id) on delete cascade,
    code text not null,
    discount_type text not null check (discount_type in ('percentage','flat','bogo','free_shipping')),
    discount_value numeric(12,2),
    start_date timestamptz not null,
    end_date timestamptz not null,
    usage_limit integer,
    usage_count integer not null default 0,
    revenue_generated numeric(12,2) not null default 0,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    unique (seller_id, code)
  );

  create table if not exists public.customer_metrics (
    id uuid primary key default gen_random_uuid(),
    seller_id uuid not null references public.sellers(id) on delete cascade,
    customer_id uuid not null,
    total_orders integer not null default 0,
    total_spend numeric(12,2) not null default 0,
    first_order_at timestamptz,
    last_order_at timestamptz,
    updated_at timestamptz not null default now(),
    unique (seller_id, customer_id)
  );

  create table if not exists public.seller_settlements (
    id uuid primary key default gen_random_uuid(),
    seller_id uuid not null references public.sellers(id) on delete cascade,
    amount numeric(12,2) not null,
    status text not null check (status in ('pending','processing','paid','failed')),
    payout_date timestamptz,
    transaction_reference text,
    notes text,
    created_at timestamptz not null default now()
  );

  create table if not exists public.seller_exports (
    id uuid primary key default gen_random_uuid(),
    seller_id uuid not null references public.sellers(id) on delete cascade,
    export_type text not null check (export_type in ('orders','products','inventory','settlements','reviews','returns')),
    format text not null check (format in ('csv','xlsx','pdf')),
    filters jsonb not null default '{}'::jsonb,
    status text not null default 'queued' check (status in ('queued','processing','ready','failed')),
    file_path text,
    error_message text,
    created_at timestamptz not null default now(),
    completed_at timestamptz
  );

  create table if not exists public.seller_funnel_events (
    id uuid primary key default gen_random_uuid(),
    seller_id uuid not null references public.sellers(id) on delete cascade,
    event_type text not null check (event_type in ('visitor','product_view','add_to_cart','checkout_started','order_placed')),
    product_id uuid references public.products(id) on delete set null,
    customer_id uuid,
    occurred_at timestamptz not null default now()
  );

  create table if not exists public.seller_reviews (
    id uuid primary key default gen_random_uuid(),
    seller_id uuid not null references public.sellers(id) on delete cascade,
    order_id uuid references public.orders(id) on delete set null,
    product_id uuid references public.products(id) on delete set null,
    customer_id uuid,
    rating smallint not null check (rating between 1 and 5),
    body text,
    seller_reply text,
    replied_at timestamptz,
    created_at timestamptz not null default now()
  );

  create index if not exists idx_products_seller_status on public.products(seller_id, status, updated_at desc);
  create index if not exists idx_variants_product on public.product_variants(product_id, updated_at desc);
  create index if not exists idx_returns_seller_status on public.returns(seller_id, status, created_at desc);
  create index if not exists idx_promotions_seller_active on public.promotions(seller_id, active, start_date, end_date);
  create index if not exists idx_customer_metrics_seller on public.customer_metrics(seller_id, total_spend desc);
  create index if not exists idx_settlements_seller_date on public.seller_settlements(seller_id, created_at desc);
  create index if not exists idx_exports_seller_date on public.seller_exports(seller_id, created_at desc);
  create index if not exists idx_funnel_seller_date on public.seller_funnel_events(seller_id, occurred_at desc);
  create index if not exists idx_reviews_seller_rating on public.seller_reviews(seller_id, rating, created_at desc);

  do $$ declare t text; begin
    foreach t in array array['sellers','products','product_variants','returns','promotions','customer_metrics','seller_settlements','seller_exports','seller_funnel_events','seller_reviews'] loop
      execute format('alter table public.%I enable row level security', t);
    end loop;
  end $$;

  grant select, insert, update, delete on public.sellers, public.products, public.product_variants,
    public.returns, public.promotions, public.customer_metrics, public.seller_exports to authenticated;
  grant select on public.seller_settlements, public.seller_funnel_events to authenticated;
  grant select on public.seller_reviews to authenticated;

  drop policy if exists "seller own rows" on public.sellers;
  create policy "seller own rows" on public.sellers for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());

  do $$ declare t text; begin
    foreach t in array array['products','product_variants','returns','promotions','customer_metrics','seller_settlements','seller_exports','seller_funnel_events'] loop
      execute format('drop policy if exists "seller owns %s" on public.%I', t, t);
    end loop;
  end $$;

  create policy "seller owns products" on public.products for all to authenticated using (public.is_my_seller(seller_id)) with check (public.is_my_seller(seller_id));
  create policy "seller owns variants" on public.product_variants for all to authenticated using (exists (select 1 from public.products p where p.id = product_id and public.is_my_seller(p.seller_id))) with check (exists (select 1 from public.products p where p.id = product_id and public.is_my_seller(p.seller_id)));
  create policy "seller owns returns" on public.returns for select to authenticated using (public.is_my_seller(seller_id));
  create policy "seller owns promotions" on public.promotions for all to authenticated using (public.is_my_seller(seller_id)) with check (public.is_my_seller(seller_id));
  create policy "seller owns metrics" on public.customer_metrics for select to authenticated using (public.is_my_seller(seller_id));
  create policy "seller reads settlements" on public.seller_settlements for select to authenticated using (public.is_my_seller(seller_id));
  create policy "seller reads exports" on public.seller_exports for select to authenticated using (public.is_my_seller(seller_id));
  create policy "seller creates exports" on public.seller_exports for insert to authenticated with check (public.is_my_seller(seller_id));
  create policy "seller reads funnel" on public.seller_funnel_events for select to authenticated using (public.is_my_seller(seller_id));
  create policy "seller reads reviews" on public.seller_reviews for select to authenticated using (public.is_my_seller(seller_id));
  create policy "seller replies to reviews" on public.seller_reviews for update to authenticated using (public.is_my_seller(seller_id)) with check (public.is_my_seller(seller_id));

  create or replace function public.set_return_status(_return_id uuid, _status text, _notes text default null)
  returns public.returns language plpgsql security definer set search_path = public as $$
  declare r public.returns;
  begin
    select * into r from public.returns where id = _return_id and public.is_my_seller(seller_id) for update;
    if not found then raise exception 'Return not found'; end if;
    if _status not in ('under_review','approved','rejected','refunded') then raise exception 'Invalid return status'; end if;
    if r.status in ('refunded','rejected') then raise exception 'Return is already closed'; end if;
    update public.returns set status = _status, notes = coalesce(_notes, notes), updated_at = now() where id = _return_id returning * into r;
    return r;
  end; $$;

  create or replace function public.create_seller_promotion(_code text, _discount_type text, _discount_value numeric, _start_date timestamptz, _end_date timestamptz, _usage_limit integer default null)
  returns public.promotions language plpgsql security definer set search_path = public as $$
  declare _seller_id uuid; p public.promotions;
  begin
    select id into _seller_id from public.sellers where user_id = auth.uid();
    if _seller_id is null then raise exception 'Seller not found'; end if;
    if _end_date <= _start_date then raise exception 'End date must be after start date'; end if;
    insert into public.promotions(seller_id, code, discount_type, discount_value, start_date, end_date, usage_limit)
    values (_seller_id, upper(trim(_code)), _discount_type, _discount_value, _start_date, _end_date, _usage_limit)
    returning * into p;
    return p;
  end; $$;

  create or replace function public.toggle_seller_promotion(_promotion_id uuid, _active boolean)
  returns public.promotions language plpgsql security definer set search_path = public as $$
  declare p public.promotions;
  begin
    update public.promotions set active = _active where id = _promotion_id and public.is_my_seller(seller_id) returning * into p;
    if not found then raise exception 'Promotion not found'; end if;
    return p;
  end; $$;

  create or replace function public.queue_seller_export(_type text, _format text, _filters jsonb default '{}'::jsonb)
  returns public.seller_exports language plpgsql security definer set search_path = public as $$
  declare _seller_id uuid; e public.seller_exports;
  begin
    select id into _seller_id from public.sellers where user_id = auth.uid();
    if _seller_id is null then raise exception 'Seller not found'; end if;
    insert into public.seller_exports(seller_id, export_type, format, filters) values (_seller_id, _type, _format, _filters) returning * into e;
    return e;
  end; $$;

  create or replace function public.get_seller_scorecard(_seller_id uuid)
  returns jsonb language plpgsql security definer set search_path = public as $$
  declare _rating numeric := 0; _returns integer := 0; _customers integer := 0; _score integer;
  begin
    if not public.is_my_seller(_seller_id) then raise exception 'Not allowed'; end if;
    select coalesce(avg(rating), 0), count(*) into _rating, _customers from public.seller_reviews where seller_id = _seller_id;
    select count(*) into _returns from public.returns where seller_id = _seller_id and status <> 'rejected';
    _score := greatest(0, least(100, round(70 + (_rating * 6) - least(_returns, 10) * 1.5)::integer));
    return jsonb_build_object(
      'score', _score,
      'category', case when _score >= 90 then 'excellent' when _score >= 75 then 'good' when _score >= 60 then 'warning' else 'critical' end,
      'customer_rating', round(_rating, 2),
      'review_count', _customers,
      'return_count', _returns,
      'recommendations', case when _returns > 5 then jsonb_build_array('Review top return reasons and improve product detail pages.') else '[]'::jsonb end
    );
  end; $$;

  revoke execute on function public.set_return_status(uuid,text,text), public.create_seller_promotion(text,text,numeric,timestamptz,timestamptz,integer), public.toggle_seller_promotion(uuid,boolean), public.queue_seller_export(text,text,jsonb) from public, anon;
  grant execute on function public.set_return_status(uuid,text,text), public.create_seller_promotion(text,text,numeric,timestamptz,timestamptz,integer), public.toggle_seller_promotion(uuid,boolean), public.queue_seller_export(text,text,jsonb) to authenticated;
  revoke execute on function public.get_seller_scorecard(uuid) from public, anon;
  grant execute on function public.get_seller_scorecard(uuid) to authenticated;

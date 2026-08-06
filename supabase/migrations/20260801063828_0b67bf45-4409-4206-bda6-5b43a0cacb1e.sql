
-- ============ ENUMS ============
create type public.app_role as enum ('admin','vendor','delivery_partner','customer');
create type public.vehicle_type as enum ('bike','scooter','ev','bicycle');
create type public.partner_status as enum ('draft','pending_verification','info_requested','approved','rejected','suspended');
create type public.availability_status as enum ('offline','online','break');
create type public.employment_type as enum ('full_time','part_time');
create type public.shift_slot as enum ('morning','afternoon','evening','night');
create type public.document_type as enum ('licence','rc','insurance','aadhaar_front','aadhaar_back','pan','vehicle_photo','profile_photo');
create type public.verification_status as enum ('pending','verified','rejected');
create type public.order_status as enum ('placed','vendor_accepted','picking','packed','ready_for_pickup','assigned','picked_up','out_for_delivery','delivered','cancelled');
create type public.assignment_status as enum ('pending','accepted','rejected','expired','navigating_to_vendor','reached_vendor','picked_up','out_for_delivery','delivered','cancelled');
create type public.payout_status as enum ('pending','processing','paid','failed');
create type public.earning_type as enum ('delivery_fee','bonus','incentive','tip','penalty');

-- ============ HELPERS ============
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ============ ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- ============ VENDORS (demo shops) ============
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  shop_name text not null,
  phone text not null,
  address text not null,
  area text,
  city text,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now()
);
grant select on public.vendors to authenticated, anon;
grant insert, update, delete on public.vendors to authenticated;
grant all on public.vendors to service_role;
alter table public.vendors enable row level security;
create policy "vendors readable" on public.vendors for select using (true);
create policy "vendors admin write" on public.vendors for all to authenticated
  using (public.has_role(auth.uid(),'admin') or owner_id = auth.uid())
  with check (public.has_role(auth.uid(),'admin') or owner_id = auth.uid());

-- ============ ZONES ============
create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  city text not null default 'Coimbatore',
  latitude double precision,
  longitude double precision,
  radius_km numeric(6,2) not null default 5,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.delivery_zones to authenticated, anon;
grant insert, update, delete on public.delivery_zones to authenticated;
grant all on public.delivery_zones to service_role;
alter table public.delivery_zones enable row level security;
create policy "zones readable" on public.delivery_zones for select using (true);
create policy "zones admin write" on public.delivery_zones for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ DELIVERY PARTNERS ============
create table public.delivery_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  full_name text not null,
  mobile text not null,
  email text not null,
  mobile_verified boolean not null default false,
  email_verified boolean not null default false,
  profile_photo_url text,
  date_of_birth date,
  gender text,
  emergency_contact_name text,
  emergency_contact_number text,
  house_number text, street text, area text, city text, state text, pincode text,
  vehicle_type public.vehicle_type,
  vehicle_number text, vehicle_brand text, vehicle_model text, vehicle_color text,
  licence_number text, licence_expiry date,
  aadhaar_number text, pan_number text,
  bank_account_holder text, bank_name text, bank_account_number text, bank_ifsc text, upi_id text,
  employment_type public.employment_type,
  status public.partner_status not null default 'draft',
  admin_note text,
  registration_step smallint not null default 1,
  availability public.availability_status not null default 'offline',
  current_latitude double precision,
  current_longitude double precision,
  location_updated_at timestamptz,
  rating numeric(3,2) not null default 5.00,
  total_deliveries integer not null default 0,
  cancelled_deliveries integer not null default 0,
  late_deliveries integer not null default 0,
  total_requests integer not null default 0,
  accepted_requests integer not null default 0,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_partners_status on public.delivery_partners(status);
create index idx_partners_availability on public.delivery_partners(availability);
grant select, insert, update on public.delivery_partners to authenticated;
grant all on public.delivery_partners to service_role;
alter table public.delivery_partners enable row level security;
create trigger t_partners_updated before update on public.delivery_partners
  for each row execute function public.update_updated_at_column();

create policy "partner reads own" on public.delivery_partners for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "partner creates own" on public.delivery_partners for insert to authenticated
  with check (user_id = auth.uid());
create policy "partner updates own" on public.delivery_partners for update to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- guard privileged columns from self-service edits
create or replace function public.guard_partner_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.has_role(auth.uid(),'admin') then return new; end if;
  new.status := old.status;
  new.approved_at := old.approved_at;
  new.admin_note := old.admin_note;
  new.rating := old.rating;
  new.total_deliveries := old.total_deliveries;
  new.cancelled_deliveries := old.cancelled_deliveries;
  new.late_deliveries := old.late_deliveries;
  new.total_requests := old.total_requests;
  new.accepted_requests := old.accepted_requests;
  if old.status = 'draft' and new.registration_step >= 9 then
    new.status := 'pending_verification';
  end if;
  if old.status = 'info_requested' then
    new.status := 'pending_verification';
  end if;
  if new.availability <> 'offline' and old.status <> 'approved' then
    new.availability := 'offline';
  end if;
  return new;
end; $$;
create trigger t_guard_partner before update on public.delivery_partners
  for each row execute function public.guard_partner_columns();

-- ============ PARTNER ZONES / SHIFTS ============
create table public.delivery_partner_zones (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.delivery_partners(id) on delete cascade,
  zone_id uuid not null references public.delivery_zones(id) on delete cascade,
  unique (partner_id, zone_id)
);
grant select, insert, delete on public.delivery_partner_zones to authenticated;
grant all on public.delivery_partner_zones to service_role;
alter table public.delivery_partner_zones enable row level security;
create policy "own partner zones" on public.delivery_partner_zones for all to authenticated
  using (exists (select 1 from public.delivery_partners p where p.id = partner_id and (p.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))))
  with check (exists (select 1 from public.delivery_partners p where p.id = partner_id and (p.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

create table public.delivery_shifts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.delivery_partners(id) on delete cascade,
  slot public.shift_slot not null,
  unique (partner_id, slot)
);
grant select, insert, delete on public.delivery_shifts to authenticated;
grant all on public.delivery_shifts to service_role;
alter table public.delivery_shifts enable row level security;
create policy "own shifts" on public.delivery_shifts for all to authenticated
  using (exists (select 1 from public.delivery_partners p where p.id = partner_id and (p.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))))
  with check (exists (select 1 from public.delivery_partners p where p.id = partner_id and (p.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

-- ============ DOCUMENTS ============
create table public.delivery_documents (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.delivery_partners(id) on delete cascade,
  doc_type public.document_type not null,
  file_path text not null,
  expiry_date date,
  status public.verification_status not null default 'pending',
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, doc_type)
);
grant select, insert, update, delete on public.delivery_documents to authenticated;
grant all on public.delivery_documents to service_role;
alter table public.delivery_documents enable row level security;
create trigger t_docs_updated before update on public.delivery_documents
  for each row execute function public.update_updated_at_column();
create policy "own documents" on public.delivery_documents for all to authenticated
  using (exists (select 1 from public.delivery_partners p where p.id = partner_id and (p.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))))
  with check (exists (select 1 from public.delivery_partners p where p.id = partner_id and (p.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

-- ============ ORDERS ============
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique default ('ORD-' || upper(substr(md5(random()::text),1,6))),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  customer_address text not null,
  customer_latitude double precision not null,
  customer_longitude double precision not null,
  items jsonb not null default '[]'::jsonb,
  order_total numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 35,
  delivery_notes text,
  delivery_otp text not null default lpad((floor(random()*10000))::text, 4, '0'),
  status public.order_status not null default 'placed',
  assigned_partner_id uuid references public.delivery_partners(id) on delete set null,
  ready_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_orders_status on public.orders(status);
create index idx_orders_partner on public.orders(assigned_partner_id);
grant select, insert, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create trigger t_orders_updated before update on public.orders
  for each row execute function public.update_updated_at_column();

create or replace function public.is_my_partner(_partner_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.delivery_partners p where p.id = _partner_id and p.user_id = auth.uid())
$$;

create or replace function public.my_partner_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.delivery_partners where user_id = auth.uid() limit 1
$$;

create policy "orders visible to vendor admin or relevant partner" on public.orders for select to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid())
    or public.is_my_partner(assigned_partner_id)
    or (status = 'ready_for_pickup' and assigned_partner_id is null
        and exists (select 1 from public.delivery_partners p
                    where p.user_id = auth.uid() and p.status = 'approved' and p.availability = 'online'))
  );
create policy "orders insert vendor admin" on public.orders for insert to authenticated
  with check (public.has_role(auth.uid(),'admin')
    or exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid()));
create policy "orders update by vendor admin or assigned partner" on public.orders for update to authenticated
  using (public.has_role(auth.uid(),'admin')
    or exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid())
    or public.is_my_partner(assigned_partner_id)
    or (status = 'ready_for_pickup' and assigned_partner_id is null))
  with check (true);

-- ============ ASSIGNMENTS ============
create table public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  partner_id uuid not null references public.delivery_partners(id) on delete cascade,
  status public.assignment_status not null default 'pending',
  distance_km numeric(6,2),
  estimated_earning numeric(10,2),
  expires_at timestamptz not null default (now() + interval '60 seconds'),
  responded_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  proof_type text,
  proof_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, partner_id)
);
create index idx_assign_partner_status on public.delivery_assignments(partner_id, status);
grant select, insert, update on public.delivery_assignments to authenticated;
grant all on public.delivery_assignments to service_role;
alter table public.delivery_assignments enable row level security;
create trigger t_assign_updated before update on public.delivery_assignments
  for each row execute function public.update_updated_at_column();
create policy "assignment visible" on public.delivery_assignments for select to authenticated
  using (public.is_my_partner(partner_id) or public.has_role(auth.uid(),'admin')
    or exists (select 1 from public.orders o join public.vendors v on v.id = o.vendor_id
               where o.id = order_id and v.owner_id = auth.uid()));
create policy "assignment insert" on public.delivery_assignments for insert to authenticated
  with check (public.is_my_partner(partner_id) or public.has_role(auth.uid(),'admin'));
create policy "assignment update by assigned partner" on public.delivery_assignments for update to authenticated
  using (public.is_my_partner(partner_id) or public.has_role(auth.uid(),'admin'))
  with check (public.is_my_partner(partner_id) or public.has_role(auth.uid(),'admin'));

-- ============ TRACKING / LOCATIONS ============
create table public.delivery_tracking (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.delivery_assignments(id) on delete cascade,
  status public.assignment_status not null,
  note text,
  created_at timestamptz not null default now()
);
create index idx_tracking_assignment on public.delivery_tracking(assignment_id);
grant select, insert on public.delivery_tracking to authenticated;
grant all on public.delivery_tracking to service_role;
alter table public.delivery_tracking enable row level security;
create policy "tracking visible" on public.delivery_tracking for select to authenticated
  using (exists (select 1 from public.delivery_assignments a where a.id = assignment_id
    and (public.is_my_partner(a.partner_id) or public.has_role(auth.uid(),'admin'))));
create policy "tracking insert" on public.delivery_tracking for insert to authenticated
  with check (exists (select 1 from public.delivery_assignments a where a.id = assignment_id
    and (public.is_my_partner(a.partner_id) or public.has_role(auth.uid(),'admin'))));

create table public.delivery_locations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.delivery_partners(id) on delete cascade,
  assignment_id uuid references public.delivery_assignments(id) on delete set null,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now()
);
create index idx_locations_partner on public.delivery_locations(partner_id, created_at desc);
grant select, insert on public.delivery_locations to authenticated;
grant all on public.delivery_locations to service_role;
alter table public.delivery_locations enable row level security;
create policy "locations visible" on public.delivery_locations for select to authenticated
  using (public.is_my_partner(partner_id) or public.has_role(auth.uid(),'admin'));
create policy "locations insert" on public.delivery_locations for insert to authenticated
  with check (public.is_my_partner(partner_id));

-- ============ EARNINGS / PAYOUTS ============
create table public.delivery_payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.delivery_partners(id) on delete cascade,
  amount numeric(10,2) not null,
  status public.payout_status not null default 'pending',
  period_start date,
  period_end date,
  reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.delivery_payouts to authenticated;
grant insert, update, delete on public.delivery_payouts to authenticated;
grant all on public.delivery_payouts to service_role;
alter table public.delivery_payouts enable row level security;
create policy "payouts visible" on public.delivery_payouts for select to authenticated
  using (public.is_my_partner(partner_id) or public.has_role(auth.uid(),'admin'));
create policy "payouts admin write" on public.delivery_payouts for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.delivery_earnings (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.delivery_partners(id) on delete cascade,
  assignment_id uuid references public.delivery_assignments(id) on delete set null,
  type public.earning_type not null default 'delivery_fee',
  amount numeric(10,2) not null,
  description text,
  payout_id uuid references public.delivery_payouts(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_earnings_partner on public.delivery_earnings(partner_id, created_at desc);
grant select, insert, update, delete on public.delivery_earnings to authenticated;
grant all on public.delivery_earnings to service_role;
alter table public.delivery_earnings enable row level security;
create policy "earnings visible" on public.delivery_earnings for select to authenticated
  using (public.is_my_partner(partner_id) or public.has_role(auth.uid(),'admin'));
create policy "earnings insert self or admin" on public.delivery_earnings for insert to authenticated
  with check (public.is_my_partner(partner_id) or public.has_role(auth.uid(),'admin'));
create policy "earnings admin manage" on public.delivery_earnings for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ RATINGS / NOTIFICATIONS ============
create table public.delivery_ratings (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.delivery_partners(id) on delete cascade,
  assignment_id uuid references public.delivery_assignments(id) on delete set null,
  rating smallint not null,
  comment text,
  is_complaint boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert on public.delivery_ratings to authenticated;
grant all on public.delivery_ratings to service_role;
alter table public.delivery_ratings enable row level security;
create policy "ratings visible" on public.delivery_ratings for select to authenticated
  using (public.is_my_partner(partner_id) or public.has_role(auth.uid(),'admin'));
create policy "ratings insert" on public.delivery_ratings for insert to authenticated with check (true);

create table public.delivery_notifications (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.delivery_partners(id) on delete cascade,
  title text not null,
  body text,
  kind text not null default 'general',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_notif_partner on public.delivery_notifications(partner_id, created_at desc);
grant select, insert, update on public.delivery_notifications to authenticated;
grant all on public.delivery_notifications to service_role;
alter table public.delivery_notifications enable row level security;
create policy "notifications visible" on public.delivery_notifications for select to authenticated
  using (public.is_my_partner(partner_id) or public.has_role(auth.uid(),'admin'));
create policy "notifications insert" on public.delivery_notifications for insert to authenticated
  with check (public.is_my_partner(partner_id) or public.has_role(auth.uid(),'admin'));
create policy "notifications update own" on public.delivery_notifications for update to authenticated
  using (public.is_my_partner(partner_id)) with check (public.is_my_partner(partner_id));

-- ============ REALTIME ============
alter table public.orders replica identity full;
alter table public.delivery_assignments replica identity full;
alter table public.delivery_partners replica identity full;
alter table public.delivery_locations replica identity full;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.delivery_assignments;
alter publication supabase_realtime add table public.delivery_partners;
alter publication supabase_realtime add table public.delivery_locations;

-- ============ SEED ZONES + DEMO VENDORS/ORDERS ============
insert into public.delivery_zones (name, city, latitude, longitude) values
 ('Peelamedu','Coimbatore',11.0270,76.9990),
 ('Gandhipuram','Coimbatore',11.0176,76.9674),
 ('Saravanampatti','Coimbatore',11.0776,76.9994),
 ('Singanallur','Coimbatore',10.9968,77.0300),
 ('R.S. Puram','Coimbatore',11.0100,76.9500),
 ('Ukkadam','Coimbatore',10.9880,76.9600);

insert into public.vendors (id, shop_name, phone, address, area, city, latitude, longitude) values
 ('11111111-1111-1111-1111-111111111111','Sri Balaji Super Market','+919812345601','12 Avinashi Road, Peelamedu','Peelamedu','Coimbatore',11.0272,76.9985),
 ('22222222-2222-2222-2222-222222222222','Green Leaf Fresh Mart','+919812345602','48 Cross Cut Road, Gandhipuram','Gandhipuram','Coimbatore',11.0180,76.9670),
 ('33333333-3333-3333-3333-333333333333','Daily Needs Kirana','+919812345603','7 Kalapatti Main Road, Saravanampatti','Saravanampatti','Coimbatore',11.0770,76.9990);

insert into public.orders (vendor_id, customer_name, customer_phone, customer_address, customer_latitude, customer_longitude, items, order_total, delivery_fee, delivery_notes, status, ready_at) values
 ('11111111-1111-1111-1111-111111111111','Anitha R','+919900011122','3B Sowripalayam Road, Peelamedu',11.0195,77.0055,'[{"name":"Amul Milk 1L","qty":2},{"name":"Brown Bread","qty":1},{"name":"Eggs (6)","qty":1}]',412.00,35,'Ring the bell twice','ready_for_pickup', now()),
 ('22222222-2222-2222-2222-222222222222','Karthik S','+919900011133','21 Nava India Road, Gandhipuram',11.0225,76.9720,'[{"name":"Tomato 1kg","qty":1},{"name":"Onion 2kg","qty":1}]',186.50,30,'Leave at gate','ready_for_pickup', now()),
 ('33333333-3333-3333-3333-333333333333','Divya M','+919900011144','9 Vilankurichi Road, Saravanampatti',11.0705,77.0055,'[{"name":"Rice 5kg","qty":1},{"name":"Toor Dal 1kg","qty":2}]',740.00,45,null,'packed', null),
 ('11111111-1111-1111-1111-111111111111','Rahul P','+919900011155','14 Hope College, Peelamedu',11.0245,77.0080,'[{"name":"Coffee Powder 500g","qty":1}]',295.00,35,null,'placed', null);

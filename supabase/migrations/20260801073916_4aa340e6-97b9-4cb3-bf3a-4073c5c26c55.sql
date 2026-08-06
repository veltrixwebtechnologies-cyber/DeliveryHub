-- 1. Guard assignment columns
create or replace function public.guard_assignment_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.has_role(auth.uid(), 'admin') then return new; end if;
  new.order_id := old.order_id;
  new.partner_id := old.partner_id;
  new.estimated_earning := old.estimated_earning;
  new.distance_km := old.distance_km;
  new.expires_at := old.expires_at;
  new.created_at := old.created_at;
  return new;
end; $$;

revoke all on function public.guard_assignment_columns() from public, anon, authenticated;

drop trigger if exists guard_assignment_columns_trg on public.delivery_assignments;
create trigger guard_assignment_columns_trg
before update on public.delivery_assignments
for each row execute function public.guard_assignment_columns();

-- 2. Earnings: admin-only inserts (complete_delivery is SECURITY DEFINER and bypasses RLS)
drop policy if exists "earnings insert self or admin" on public.delivery_earnings;
create policy "earnings insert admin only"
on public.delivery_earnings for insert to authenticated
with check (public.has_role(auth.uid(), 'admin'));

-- 3. Documents: partners cannot self-verify
create or replace function public.guard_document_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.has_role(auth.uid(), 'admin') then return new; end if;
  new.partner_id := old.partner_id;
  new.doc_type := old.doc_type;
  new.reviewer_note := old.reviewer_note;
  new.created_at := old.created_at;
  if new.file_path is distinct from old.file_path
     or new.expiry_date is distinct from old.expiry_date then
    new.status := 'pending';
  else
    new.status := old.status;
  end if;
  return new;
end; $$;

revoke all on function public.guard_document_columns() from public, anon, authenticated;

drop trigger if exists guard_document_columns_trg on public.delivery_documents;
create trigger guard_document_columns_trg
before update on public.delivery_documents
for each row execute function public.guard_document_columns();

create or replace function public.guard_document_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.has_role(auth.uid(), 'admin') then return new; end if;
  new.status := 'pending';
  new.reviewer_note := null;
  return new;
end; $$;

revoke all on function public.guard_document_insert() from public, anon, authenticated;

drop trigger if exists guard_document_insert_trg on public.delivery_documents;
create trigger guard_document_insert_trg
before insert on public.delivery_documents
for each row execute function public.guard_document_insert();

create policy "riders manage own docs" on storage.objects for all to authenticated
  using (bucket_id = 'delivery-docs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'delivery-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "admins read all docs" on storage.objects for select to authenticated
  using (bucket_id = 'delivery-docs' and public.has_role(auth.uid(),'admin'));

-- 038 (aplicada 30/10): desenho de linha por REFERÊNCIA + armazenamento 'desenhos'
alter table public.produtos add column if not exists desenho_url text;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('desenhos', 'desenhos', true, 2097152, array['image/png','image/jpeg','image/webp']) on conflict (id) do nothing;
create policy "desenhos leitura" on storage.objects for select using (bucket_id = 'desenhos');
create policy "desenhos envio" on storage.objects for insert to authenticated with check (bucket_id = 'desenhos');
create policy "desenhos troca" on storage.objects for update to authenticated using (bucket_id = 'desenhos');
create policy "desenhos apagar" on storage.objects for delete to authenticated using (bucket_id = 'desenhos');

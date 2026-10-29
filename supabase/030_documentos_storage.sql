-- 030 · Arquivo "documentos" (PDF de pedidos/orçamentos para enviar ao cliente pelo WhatsApp)
-- Privado: o link enviado ao cliente é assinado e expira (30 dias). Só usuários da empresa gravam/leem.
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false)
on conflict (id) do nothing;

drop policy if exists documentos_ler on storage.objects;
create policy documentos_ler on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = public.minha_empresa()::text);
drop policy if exists documentos_gravar on storage.objects;
create policy documentos_gravar on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = public.minha_empresa()::text);
drop policy if exists documentos_trocar on storage.objects;
create policy documentos_trocar on storage.objects for update to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = public.minha_empresa()::text);

-- 036 · Link curto para o cliente: dbaesse-erp.vercel.app/d/<codigo>
-- O PDF continua no arquivo privado "documentos"; a função "doc" entrega pelo código (sem token gigante na mensagem).
create table if not exists public.documentos_links (
  codigo text primary key,
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  caminho text not null,
  nome text not null,
  expira_em timestamptz not null default now() + interval '30 days',
  criado_em timestamptz not null default now()
);
alter table public.documentos_links enable row level security;
drop policy if exists documentos_links_gravar on public.documentos_links;
create policy documentos_links_gravar on public.documentos_links for insert to authenticated
  with check (empresa_id = public.minha_empresa() and split_part(caminho, '/', 1) = public.minha_empresa()::text);
drop policy if exists documentos_links_ler on public.documentos_links;
create policy documentos_links_ler on public.documentos_links for select to authenticated
  using (empresa_id = public.minha_empresa());

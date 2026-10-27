-- 018 · Simulador de custo: estudos de produto que NÃO entram no catálogo
create table if not exists public.simulacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  nome text not null,
  base_produto_id uuid references public.produtos(id) on delete set null,
  linhas jsonb not null default '[]'::jsonb,
  preco_atacado numeric(10,2),
  preco_varejo numeric(10,2),
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.simulacoes enable row level security;
drop policy if exists simulacoes_empresa on public.simulacoes;
create policy simulacoes_empresa on public.simulacoes for all to authenticated
  using (empresa_id = public.minha_empresa()) with check (empresa_id = public.minha_empresa());
grant select, insert, update, delete on public.simulacoes to authenticated;
create index if not exists simulacoes_empresa_idx on public.simulacoes(empresa_id);

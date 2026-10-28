-- 022 · Programação de PALMILHA para estoque (relação para o prestador de serviço)
-- itens: [{ tipo: 'PALMILHA SALTO', cor_id, obs, grade: { "34": 12, ... } }]
-- insumos: [{ descricao: 'NAPA FLOATER', quantidade: '3 m' }] — o que vai junto para o prestador (baixa fica para depois)
create sequence if not exists public.programacoes_palmilha_numero_seq;
create table if not exists public.programacoes_palmilha (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  numero bigint not null default nextval('public.programacoes_palmilha_numero_seq'),
  prestador_id uuid references public.parceiros(id) on delete set null,
  prestador text, data date not null default current_date, previsao date, observacao text,
  itens jsonb not null default '[]'::jsonb, insumos jsonb not null default '[]'::jsonb,
  status text not null default 'aberta' check (status in ('aberta','recebida','cancelada')),
  criado_em timestamptz not null default now()
);
alter table public.programacoes_palmilha enable row level security;
create policy programacoes_palmilha_empresa on public.programacoes_palmilha for all to authenticated
  using (empresa_id = public.minha_empresa()) with check (empresa_id = public.minha_empresa());
grant usage, select on sequence public.programacoes_palmilha_numero_seq to authenticated;
create trigger programacoes_palmilha_hist after insert or update or delete on public.programacoes_palmilha
  for each row execute function public.registrar_historico();

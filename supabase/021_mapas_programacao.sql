-- 021 · Mapa de programação (planilha PROGRAMAÇÃO): cabeçalho + referências; cada cor vira uma OP
create sequence if not exists public.programacoes_numero_seq;
create table if not exists public.programacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  numero bigint not null default nextval('public.programacoes_numero_seq'),
  pedido text, parceiro_id uuid references public.parceiros(id) on delete set null,
  cliente text, marca text, data date not null default current_date, previsao date, observacao text,
  criado_em timestamptz not null default now()
);
-- RLS por empresa + histórico; grant na sequência
alter table public.ordens_producao add column if not exists programacao_id uuid references public.programacoes(id) on delete set null;
-- Regra da cor da palmilha: palavra-chave no modelo → posição contando do fim (1 = última, 2 = penúltima)
alter table public.empresas add column if not exists regra_palmilha jsonb not null
  default '[{"chave":"SALTO BLOCO","posicao":2},{"chave":"*","posicao":1}]'::jsonb;

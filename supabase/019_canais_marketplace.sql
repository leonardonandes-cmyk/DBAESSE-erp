-- 019 · Margem por loja (Shopee, TikTok Shop, Mercado Livre): taxa por faixa + despesas + preço próprio por modelo
-- (aplicado via MCP; ver histórico do projeto para o SQL completo com o seed das 3 lojas)
create table if not exists public.canais_venda (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  codigo text not null, nome text not null, cor text,
  faixas jsonb not null default '[]'::jsonb, despesas jsonb not null default '[]'::jsonb,
  margem_alvo numeric(6,4) not null default 0.20, observacao text,
  ativo boolean not null default true, ordem int not null default 0,
  unique (empresa_id, codigo)
);
create table if not exists public.precos_canal (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  canal_id uuid not null references public.canais_venda(id) on delete cascade,
  preco numeric(10,2) not null check (preco > 0),
  atualizado_em timestamptz not null default now(),
  unique (produto_id, canal_id)
);
-- RLS por empresa (minha_empresa()) e trigger de histórico nas duas tabelas.

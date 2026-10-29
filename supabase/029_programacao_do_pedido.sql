-- 029 · Programação de cliente gerada a partir do PEDIDO (atacado)
-- A programação fica atrelada ao pedido: corrigiu o pedido → a programação acompanha (cores já em produção ficam travadas).
alter table public.programacoes add column if not exists pedido_id uuid references public.pedidos(id) on delete set null;
create index if not exists programacoes_pedido on public.programacoes(pedido_id);

-- 017 · Endereço de entrega por pedido (vazio = endereço do cadastro do cliente)
alter table public.pedidos add column if not exists endereco_entrega text;
comment on column public.pedidos.endereco_entrega is 'Endereço de entrega só desta venda; vazio = endereço do cadastro do cliente';

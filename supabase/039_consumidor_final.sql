-- 039 (aplicada 30/10): sacoleira = consumidor final (cadastro rápido nome + telefone),
-- documento da venda no pedido (nfe | consumidor) e controle de "notas a emitir" (faturamento ainda no UpSeller)
alter table public.parceiros add column if not exists consumidor_final boolean not null default false;
alter table public.pedidos add column if not exists documento text not null default 'nfe';
alter table public.pedidos add constraint pedidos_documento_chk check (documento in ('nfe','consumidor'));
alter table public.pedidos add column if not exists nota_emitida boolean not null default false;
alter table public.pedidos add column if not exists nota_numero text;
-- pendencias_cadastro: consumidor final só exige telefone (ver função no banco)

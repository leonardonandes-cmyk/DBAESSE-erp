-- 024 · Modalidades de venda padrão do sistema: ATACADO · MESCLADO · DROP · MARKETPLACE · VAREJO
-- Canal "Revenda" passa a se chamar "Mesclado" (compra no variado, sem fechar grade).
-- Lista de preço "Variado" (codigo variado) passa a ser "Mesclado" (codigo mesclado).
-- Marketplace = Shopee, TikTok Shop, Mercado Livre · Varejo = Instagram, Loja / varejo.

update public.pedidos set canal = 'Mesclado' where canal = 'Revenda';
update public.parceiros set canal = 'Mesclado' where canal = 'Revenda';

update public.listas_preco set codigo = 'mesclado', nome = 'Mesclado',
  descricao = coalesce(nullif(replace(descricao, 'variado', 'mesclado'), ''), 'Compra mesclada (sem fechar grade)')
where codigo = 'variado';
update public.parceiros set lista = 'mesclado' where lista = 'variado';
update public.pedidos set lista = 'mesclado' where lista = 'variado';

-- categoria das contas a receber geradas pelos pedidos
update public.titulos set categoria = 'Venda mesclado' where categoria = 'Venda revenda';

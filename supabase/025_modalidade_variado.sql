-- 025 · A modalidade fica com o nome VARIADO (em vez de Mesclado): ATACADO · VARIADO · DROP · MARKETPLACE · VAREJO
update public.pedidos set canal = 'Variado' where canal = 'Mesclado';
update public.parceiros set canal = 'Variado' where canal = 'Mesclado';
update public.listas_preco set codigo = 'variado', nome = 'Variado', descricao = replace(descricao, 'mesclad', 'variad') where codigo = 'mesclado';
update public.parceiros set lista = 'variado' where lista = 'mesclado';
update public.pedidos set lista = 'variado' where lista = 'mesclado';
update public.titulos set categoria = 'Venda variado' where categoria = 'Venda mesclado';

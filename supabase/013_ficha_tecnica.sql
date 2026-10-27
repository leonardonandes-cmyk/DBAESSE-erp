-- 013 · Ficha técnica completa (padrão da planilha FICHA TÉCNICA da DBAESSE)
-- Seções: cabedal, solado (solado/palmilha), acabamento, mão de obra, custo fixo (rateio)
-- Cada linha: material + consumo por par OU rendimento (quantos pares rende 1 unidade)

-- Materiais: tipo (material de estoque / mão de obra / custo fixo) e código da planilha MP
alter table public.materiais add column if not exists tipo text not null default 'material';
alter table public.materiais drop constraint if exists materiais_tipo_check;
alter table public.materiais add constraint materiais_tipo_check check (tipo in ('material','mao_de_obra','custo_fixo'));
alter table public.materiais add column if not exists codigo int;
alter table public.materiais drop constraint if exists materiais_unidade_check;
alter table public.materiais add constraint materiais_unidade_check
  check (unidade in ('par','un','m','m2','kg','g','l','rolo','folha','placa','pc','rateio'));

-- Ficha: seção, modo, rendimento, custo próprio da linha e ordem
alter table public.ficha_consumo alter column consumo type numeric(16,6);
alter table public.ficha_consumo add column if not exists secao text not null default 'cabedal';
alter table public.ficha_consumo drop constraint if exists ficha_consumo_secao_check;
alter table public.ficha_consumo add constraint ficha_consumo_secao_check
  check (secao in ('cabedal','solado','acabamento','mao_de_obra','rateio'));
alter table public.ficha_consumo add column if not exists modo text not null default 'consumo';
alter table public.ficha_consumo drop constraint if exists ficha_consumo_modo_check;
alter table public.ficha_consumo add constraint ficha_consumo_modo_check check (modo in ('consumo','rendimento'));
alter table public.ficha_consumo add column if not exists rendimento numeric(12,4);   -- pares por unidade (modo rendimento)
alter table public.ficha_consumo add column if not exists custo_proprio numeric(12,4); -- quando a linha usa um custo diferente do cadastro
alter table public.ficha_consumo add column if not exists ordem int not null default 0;
alter table public.ficha_consumo drop constraint if exists ficha_consumo_produto_id_material_id_key;

-- Listas de preço: despesas do canal (% ou R$ por par) e margem-alvo (para o preço ideal)
alter table public.listas_preco add column if not exists despesas jsonb not null default '[]'::jsonb;
alter table public.listas_preco add column if not exists margem_alvo numeric(6,4) not null default 0.25;

update public.listas_preco set margem_alvo = 0.25, despesas = '[
  {"nome":"Comissão Fartura","pct":0,"rs":1},
  {"nome":"Imposto","pct":0.085,"rs":0},
  {"nome":"Frete","pct":0,"rs":0},
  {"nome":"Perda","pct":0.02,"rs":0},
  {"nome":"Investimento","pct":0.03,"rs":0},
  {"nome":"Comissão vendedora","pct":0.01,"rs":0}]'::jsonb
where codigo in ('atacado','variado') and despesas = '[]'::jsonb;

update public.listas_preco set margem_alvo = 0.30, despesas = '[
  {"nome":"Comissão","pct":0,"rs":1},
  {"nome":"Imposto","pct":0.085,"rs":0},
  {"nome":"Frete","pct":0,"rs":0},
  {"nome":"Perda","pct":0.02,"rs":0},
  {"nome":"Investimento","pct":0.03,"rs":0}]'::jsonb
where codigo = 'drop' and despesas = '[]'::jsonb;

update public.listas_preco set margem_alvo = 0.30, despesas = '[
  {"nome":"Taxa marketplace","pct":0.20,"rs":0},
  {"nome":"Imposto","pct":0.085,"rs":0},
  {"nome":"Embalagem","pct":0,"rs":0.26},
  {"nome":"Etiqueta","pct":0,"rs":0.10},
  {"nome":"Perda","pct":0.03,"rs":0},
  {"nome":"Investimento","pct":0.02,"rs":0}]'::jsonb
where codigo = 'varejo' and despesas = '[]'::jsonb;

-- Concluir OP: só baixa do estoque o que é MATERIAL (mão de obra e custo fixo entram só no custo)
create or replace function public.concluir_op(p_op uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v public.ordens_producao; v_pares int;
begin
  select * into v from public.ordens_producao where id = p_op for update;
  if not found then raise exception 'Ordem não encontrada'; end if;
  if v.status = 'cancelada' then raise exception 'Ordem cancelada não pode ser concluída'; end if;
  if not v.estoque_lancado then
    insert into public.estoque_movimentos (empresa_id, sku_id, tipo, quantidade, motivo, observacao, local)
    select i.empresa_id, i.sku_id, 'entrada', i.quantidade, 'producao', 'OP-' || lpad(v.numero::text, 4, '0'), 'bulk'
    from public.op_itens i where i.op_id = p_op;

    select coalesce(sum(quantidade), 0) into v_pares from public.op_itens where op_id = p_op;

    insert into public.material_movimentos (empresa_id, material_id, tipo, quantidade, motivo, op_id)
    select f.empresa_id, f.material_id, 'saida', round(sum(f.consumo * v_pares * (1 + f.perda_pct / 100)), 3), 'producao', p_op
    from public.ficha_consumo f join public.materiais m on m.id = f.material_id
    where f.produto_id = v.produto_id and m.tipo = 'material' and not m.por_numero and v_pares > 0
    group by f.empresa_id, f.material_id;

    insert into public.material_movimentos (empresa_id, material_id, numero, tipo, quantidade, motivo, op_id)
    select f.empresa_id, f.material_id, s.numero, 'saida', round(sum(f.consumo * i.quantidade * (1 + f.perda_pct / 100)), 3), 'producao', p_op
    from public.ficha_consumo f
    join public.materiais m on m.id = f.material_id and m.por_numero and m.tipo = 'material'
    join public.op_itens i on i.op_id = p_op
    join public.skus s on s.id = i.sku_id
    where f.produto_id = v.produto_id
    group by f.empresa_id, f.material_id, s.numero;
  end if;
  update public.op_etapas set status = 'concluida', fim = coalesce(fim, now()) where op_id = p_op and status <> 'concluida';
  update public.ordens_producao set status = 'concluida', estoque_lancado = true, concluida_em = now() where id = p_op;
end $$;

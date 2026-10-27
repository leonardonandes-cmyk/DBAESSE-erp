-- 009 · Locais de estoque: BULK (caixas master fechadas) e PICK (pares avulsos para separação)
-- Fluxo: produção → Bulk → replenishment → Pick → picking → expedição

alter table public.estoque_movimentos
  add column if not exists local text not null default 'bulk';
alter table public.estoque_movimentos drop constraint if exists estoque_movimentos_local_check;
alter table public.estoque_movimentos
  add constraint estoque_movimentos_local_check check (local in ('bulk','pick'));
create index if not exists estoque_mov_sku_local on public.estoque_movimentos(sku_id, local);

-- Saldo total + por local (colunas novas no fim para não quebrar quem já usa a view)
create or replace view public.estoque_saldos with (security_invoker = true) as
select s.id as sku_id, s.empresa_id, s.produto_id, s.cor_id, s.numero, s.sku,
       coalesce(sum(case m.tipo when 'entrada' then m.quantidade
                                when 'saida' then -m.quantidade
                                else m.quantidade end), 0)::int as saldo,
       coalesce(sum(case when m.local = 'bulk' then
                    case m.tipo when 'entrada' then m.quantidade when 'saida' then -m.quantidade else m.quantidade end
                    end), 0)::int as saldo_bulk,
       coalesce(sum(case when m.local = 'pick' then
                    case m.tipo when 'entrada' then m.quantidade when 'saida' then -m.quantidade else m.quantidade end
                    end), 0)::int as saldo_pick
from public.skus s
left join public.estoque_movimentos m on m.sku_id = s.id
group by s.id;

-- Faturar: tira primeiro do Pick e o que faltar do Bulk (uma vez só)
create or replace function public.faturar_pedido(p_pedido uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v public.pedidos;
begin
  select * into v from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if v.status = 'cancelado' then raise exception 'Pedido cancelado não pode ser faturado'; end if;
  if not v.estoque_baixado then
    with itens as (
      select i.empresa_id, i.sku_id, sum(i.quantidade)::int as qtd
      from public.pedido_itens i where i.pedido_id = p_pedido
      group by i.empresa_id, i.sku_id
    ), calc as (
      select it.*, least(it.qtd, greatest(0, coalesce(s.saldo_pick, 0))) as do_pick
      from itens it left join public.estoque_saldos s on s.sku_id = it.sku_id
    ), linhas as (
      select empresa_id, sku_id, 'pick' as local, do_pick as q from calc where do_pick > 0
      union all
      select empresa_id, sku_id, 'bulk', qtd - do_pick from calc where qtd - do_pick > 0
    )
    insert into public.estoque_movimentos (empresa_id, sku_id, tipo, quantidade, motivo, pedido_id, local)
    select empresa_id, sku_id, 'saida', q, 'venda', p_pedido, local from linhas;
  end if;
  update public.pedidos set status = 'faturado', estoque_baixado = true where id = p_pedido;
end $$;

-- Cancelar: devolve exatamente para o local de onde saiu
create or replace function public.cancelar_pedido(p_pedido uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v public.pedidos;
begin
  select * into v from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if v.estoque_baixado then
    insert into public.estoque_movimentos (empresa_id, sku_id, tipo, quantidade, motivo, pedido_id, local)
    select m.empresa_id, m.sku_id, 'entrada', sum(m.quantidade)::int, 'cancelamento', p_pedido, m.local
    from public.estoque_movimentos m
    where m.pedido_id = p_pedido and m.tipo = 'saida' and m.motivo = 'venda'
    group by m.empresa_id, m.sku_id, m.local;
  end if;
  update public.pedidos set status = 'cancelado', estoque_baixado = false where id = p_pedido;
end $$;

-- Replenishment: move pares entre locais (Bulk → Pick, ou o contrário) num passo só
-- p_itens = [{"sku_id": "...", "quantidade": 3}, ...]
create or replace function public.transferir_estoque(p_itens jsonb, p_de text, p_para text, p_obs text default null)
returns int language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if p_de not in ('bulk','pick') or p_para not in ('bulk','pick') or p_de = p_para then
    raise exception 'Locais inválidos';
  end if;
  with t as (
    select (x->>'sku_id')::uuid as sku_id, (x->>'quantidade')::int as q
    from jsonb_array_elements(p_itens) x where (x->>'quantidade')::int > 0
  ), lados as (
    select sku_id, 'saida' as tipo, q, p_de as local from t
    union all
    select sku_id, 'entrada', q, p_para from t
  )
  insert into public.estoque_movimentos (sku_id, tipo, quantidade, motivo, observacao, local)
  select sku_id, tipo, q, 'replenishment', p_obs, local from lados;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Nenhuma quantidade informada'; end if;
  return n / 2;
end $$;
revoke execute on function public.transferir_estoque(jsonb, text, text, text) from public, anon;
grant execute on function public.transferir_estoque(jsonb, text, text, text) to authenticated;

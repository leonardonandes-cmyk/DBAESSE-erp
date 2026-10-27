-- 011 · Separação de pedido pelo app (bipando os pares)
alter table public.pedido_itens add column if not exists separado int not null default 0;
alter table public.pedido_itens drop constraint if exists pedido_itens_separado_check;
alter table public.pedido_itens add constraint pedido_itens_separado_check check (separado >= 0 and separado <= quantidade);
alter table public.pedidos add column if not exists separado_em timestamptz;

-- Bipou um par (p_delta = 1) ou desfez (p_delta = -1). Devolve como ficou o item e o pedido.
create or replace function public.separar_item(p_pedido uuid, p_sku uuid, p_delta int default 1)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v public.pedidos; it public.pedido_itens; v_falta int;
begin
  select * into v from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if v.status in ('faturado','entregue','cancelado') then raise exception 'Pedido % não pode mais ser separado', v.status; end if;

  if p_delta > 0 then
    select * into it from public.pedido_itens where pedido_id = p_pedido and sku_id = p_sku and separado < quantidade order by id limit 1 for update;
    if not found then
      if exists (select 1 from public.pedido_itens where pedido_id = p_pedido and sku_id = p_sku)
        then raise exception 'JA_COMPLETO';
        else raise exception 'NAO_ESTA_NO_PEDIDO';
      end if;
    end if;
    update public.pedido_itens set separado = separado + 1 where id = it.id returning * into it;
  else
    select * into it from public.pedido_itens where pedido_id = p_pedido and sku_id = p_sku and separado > 0 order by id desc limit 1 for update;
    if not found then raise exception 'NADA_PARA_DESFAZER'; end if;
    update public.pedido_itens set separado = separado - 1 where id = it.id returning * into it;
  end if;

  select coalesce(sum(quantidade - separado), 0) into v_falta from public.pedido_itens where pedido_id = p_pedido;
  update public.pedidos
     set status = case when status in ('orcamento','aprovado','producao') then 'separacao' else status end,
         separado_em = case when v_falta = 0 then now() else null end
   where id = p_pedido;

  return jsonb_build_object('sku_id', it.sku_id, 'separado', (select sum(separado) from public.pedido_itens where pedido_id = p_pedido and sku_id = p_sku),
                            'quantidade', (select sum(quantidade) from public.pedido_itens where pedido_id = p_pedido and sku_id = p_sku),
                            'falta_pedido', v_falta);
end $$;
revoke execute on function public.separar_item(uuid, uuid, int) from public, anon;
grant execute on function public.separar_item(uuid, uuid, int) to authenticated;

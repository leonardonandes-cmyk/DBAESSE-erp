-- Atacado, Variado e Drop só faturam com o cadastro do cliente completo
create or replace function public.pendencias_cadastro(p_parceiro uuid)
returns text[] language sql stable set search_path to 'public' as $$
  select case when p.id is null then array['cliente'] else array_remove(array[
    case when coalesce(trim(p.documento),'') = '' then 'CPF/CNPJ' end,
    case when coalesce(trim(p.telefone),'') = '' then 'telefone' end,
    case when coalesce(trim(p.cep),'') = '' then 'CEP' end,
    case when coalesce(trim(p.endereco),'') = '' then 'rua' end,
    case when coalesce(trim(p.numero),'') = '' then 'número' end,
    case when coalesce(trim(p.bairro),'') = '' then 'bairro' end,
    case when coalesce(trim(p.cidade),'') = '' then 'cidade' end,
    case when coalesce(trim(p.uf),'') = '' then 'UF' end
  ], null) end
  from (select 1) x left join public.parceiros p on p.id = p_parceiro
$$;

CREATE OR REPLACE FUNCTION public.faturar_pedido(p_pedido uuid)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
declare v public.pedidos; falta text[];
begin
  select * into v from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if v.status = 'cancelado' then raise exception 'Pedido cancelado não pode ser faturado'; end if;
  if v.canal in ('Atacado','Variado','Drop') then
    falta := public.pendencias_cadastro(v.parceiro_id);
    if array_length(falta, 1) > 0 then
      raise exception 'Cadastro do cliente incompleto — falta: %. Complete o cadastro para faturar.', array_to_string(falta, ', ');
    end if;
  end if;
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
end $function$;

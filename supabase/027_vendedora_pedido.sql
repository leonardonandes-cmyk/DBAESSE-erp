-- 027 · Comissão atrelada à VENDEDORA do pedido
-- Cada pedido tem uma vendedora (preenchida sozinha pela modalidade, editável no pedido).
-- Regra 'vendedora': paga a vendedora do pedido quando a modalidade do pedido está na lista dela.
-- Padrão: Sabrina = atacado, variado, varejo · Pamela = drop · marketplace = ninguém. Polo Fartura continua por fora.

alter table public.pedidos add column if not exists vendedora text;
comment on column public.pedidos.vendedora is 'Quem vendeu (comissão). Vazio = sem comissão de vendedora';

alter table public.comissao_regras add column if not exists modalidades text[] not null default '{}';
alter table public.comissao_regras drop constraint if exists comissao_regras_criterio_check;
alter table public.comissao_regras add constraint comissao_regras_criterio_check check (criterio in ('modalidade','grupo','vendedora'));

-- mesmo mapa de lib/modalidades.js
create or replace function public.modalidade_do_canal(c text) returns text language sql immutable as $$
  select case
    when c = 'Variado' then 'variado'
    when c = 'Drop' then 'drop'
    when c in ('Shopee','TikTok Shop','Mercado Livre') then 'marketplace'
    when c in ('Instagram','Loja / varejo') then 'varejo'
    else 'atacado' end
$$;

update public.comissao_regras set criterio = 'vendedora', alvo = '', modalidades = '{atacado,variado,varejo}'
where beneficiario = 'Sabrina' and criterio = 'modalidade';
update public.comissao_regras set criterio = 'vendedora', alvo = '', modalidades = '{drop}'
where beneficiario = 'Pamela' and criterio = 'modalidade';

-- vendedora padrão do pedido = dona da modalidade (pela regra ativa)
create or replace function public.pedido_vendedora_padrao() returns trigger language plpgsql set search_path = public as $$
begin
  if new.vendedora is null then
    select r.beneficiario into new.vendedora from public.comissao_regras r
    where r.empresa_id = new.empresa_id and r.ativo and r.criterio = 'vendedora'
      and public.modalidade_do_canal(new.canal) = any(r.modalidades)
    order by r.ordem limit 1;
  end if;
  return new;
end $$;
drop trigger if exists pedidos_vendedora on public.pedidos;
create trigger pedidos_vendedora before insert on public.pedidos for each row execute function public.pedido_vendedora_padrao();

update public.pedidos p set vendedora = (
  select r.beneficiario from public.comissao_regras r
  where r.empresa_id = p.empresa_id and r.ativo and r.criterio = 'vendedora'
    and public.modalidade_do_canal(p.canal) = any(r.modalidades)
  order by r.ordem limit 1)
where p.vendedora is null;

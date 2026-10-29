-- 028 · Repasses (comissões) — visível SÓ para o DONO da empresa
-- Regras de repasse: só o dono lê/altera. Contas com categoria 'Repasse': só o dono vê.
-- A equipe continua tendo a vendedora sugerida no pedido (função vendedoras(), só nomes, sem valores).

create or replace function public.sou_dono() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.empresas e where e.id = public.minha_empresa() and e.dono_id = auth.uid())
$$;
revoke execute on function public.sou_dono() from anon, public;
grant execute on function public.sou_dono() to authenticated;

drop policy if exists comissao_regras_empresa on public.comissao_regras;
create policy comissao_regras_empresa on public.comissao_regras for all to authenticated
  using (empresa_id = public.minha_empresa() and public.sou_dono())
  with check (empresa_id = public.minha_empresa() and public.sou_dono());

update public.titulos set categoria = 'Repasse', descricao = replace(descricao, 'Comissão', 'Repasse') where categoria = 'Comissão';
drop policy if exists titulos_repasse_so_dono on public.titulos;
create policy titulos_repasse_so_dono on public.titulos as restrictive for all to authenticated
  using (coalesce(categoria, '') <> 'Repasse' or public.sou_dono())
  with check (coalesce(categoria, '') <> 'Repasse' or public.sou_dono());

-- o gatilho do pedido lê as regras mesmo quando quem vende não é o dono
alter function public.pedido_vendedora_padrao() security definer;

create or replace function public.vendedoras()
returns table (nome text, modalidades text[], ordem int)
language sql stable security definer set search_path = public as $$
  select r.beneficiario, r.modalidades, r.ordem from public.comissao_regras r
  where r.empresa_id = public.minha_empresa() and r.ativo and r.criterio = 'vendedora'
  order by r.ordem
$$;
revoke execute on function public.vendedoras() from anon, public;
grant execute on function public.vendedoras() to authenticated;

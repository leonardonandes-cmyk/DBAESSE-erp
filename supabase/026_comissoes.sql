-- 026 · Comissões
-- Regras: por MODALIDADE do pedido (atacado, variado, drop, marketplace, varejo) ou por POLO/GRUPO da cliente (ex.: Fartura).
-- Tipo: 'pct' = % do valor faturado (com desconto) · 'par' = R$ por par. Regras que valem para o mesmo pedido SOMAM.
-- Base: pedidos faturados ou entregues, pela data do pedido.

alter table public.parceiros add column if not exists grupo text;
comment on column public.parceiros.grupo is 'Polo / grupo da cliente (ex.: Fartura) — usado nas comissões';
alter table public.pedidos add column if not exists grupo text;
comment on column public.pedidos.grupo is 'Polo / grupo da cliente no momento do pedido (copiado do cadastro)';

-- o pedido herda o polo/grupo do cadastro da cliente
create or replace function public.pedido_herda_grupo() returns trigger language plpgsql set search_path = public as $$
begin
  if new.grupo is null and new.parceiro_id is not null then
    select grupo into new.grupo from public.parceiros where id = new.parceiro_id;
  end if;
  return new;
end $$;
drop trigger if exists pedidos_grupo on public.pedidos;
create trigger pedidos_grupo before insert on public.pedidos for each row execute function public.pedido_herda_grupo();

create table if not exists public.comissao_regras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  beneficiario text not null,
  parceiro_id uuid references public.parceiros(id) on delete set null,
  criterio text not null check (criterio in ('modalidade','grupo')),
  alvo text not null,
  tipo text not null check (tipo in ('pct','par')),
  valor numeric(10,4) not null check (valor >= 0),
  ativo boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
alter table public.comissao_regras enable row level security;
drop policy if exists comissao_regras_empresa on public.comissao_regras;
create policy comissao_regras_empresa on public.comissao_regras for all to authenticated
  using (empresa_id = public.minha_empresa()) with check (empresa_id = public.minha_empresa());
grant select, insert, update, delete on public.comissao_regras to authenticated;
drop trigger if exists comissao_regras_hist on public.comissao_regras;
create trigger comissao_regras_hist after insert or update or delete on public.comissao_regras
  for each row execute function public.registrar_historico();

insert into public.comissao_regras (empresa_id, beneficiario, criterio, alvo, tipo, valor, ordem)
select e.id, v.b, v.c, v.a, v.t, v.v, v.o
from public.empresas e cross join (values
  ('Polo Fartura', 'grupo', 'Fartura', 'par', 1.00, 1),
  ('Sabrina', 'modalidade', 'atacado', 'pct', 0.01, 2),
  ('Pamela', 'modalidade', 'drop', 'pct', 0.01, 3)
) v(b, c, a, t, v, o)
where not exists (select 1 from public.comissao_regras r where r.empresa_id = e.id);

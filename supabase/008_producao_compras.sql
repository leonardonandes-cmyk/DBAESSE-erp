-- =====================================================================
-- 008: Produção (fase 5) + Materiais, ficha de consumo e Compras (fase 8)
-- Mesmo padrão: empresa_id + RLS + histórico.
-- =====================================================================

-- ---------- Setores da fábrica (editáveis em Configurações) ----------
create table if not exists public.setores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  nome text not null,
  ordem int not null default 0,
  ativo boolean not null default true,
  unique (empresa_id, nome)
);
insert into public.setores (empresa_id, nome, ordem)
select e.id, s.nome, s.ordem from public.empresas e,
(values ('Corte',1),('Pesponto',2),('Montagem',3),('Acabamento',4),('Revisão',5),('Embalagem',6)) as s(nome, ordem)
where e.slug = 'dbaesse' on conflict do nothing;

-- ---------- Ordens de produção ----------
create table if not exists public.ordens_producao (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  numero bigint generated always as identity,
  produto_id uuid not null references public.produtos(id),
  cor_id uuid not null references public.cores(id),
  pedido_id uuid references public.pedidos(id) on delete set null,
  status text not null default 'aberta' check (status in ('aberta','em_producao','concluida','cancelada')),
  prioridade text not null default 'normal' check (prioridade in ('normal','urgente')),
  prazo date,
  observacao text,
  estoque_lancado boolean not null default false,
  concluida_em timestamptz,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists op_status on public.ordens_producao(empresa_id, status);

create table if not exists public.op_itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  op_id uuid not null references public.ordens_producao(id) on delete cascade,
  sku_id uuid not null references public.skus(id),
  quantidade int not null check (quantidade > 0),
  unique (op_id, sku_id)
);
create index if not exists op_itens_op on public.op_itens(op_id);

create table if not exists public.op_etapas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  op_id uuid not null references public.ordens_producao(id) on delete cascade,
  setor_id uuid not null references public.setores(id),
  ordem int not null,
  status text not null default 'pendente' check (status in ('pendente','em_curso','concluida')),
  inicio timestamptz,
  fim timestamptz,
  qtd_ok int,
  qtd_perda int not null default 0 check (qtd_perda >= 0),
  responsavel text,
  observacao text,
  unique (op_id, setor_id)
);
create index if not exists op_etapas_op on public.op_etapas(op_id);

-- Toda OP nova já nasce com uma etapa para cada setor ativo, na ordem
create or replace function public.criar_etapas_op()
returns trigger language plpgsql set search_path = public as $$
begin
  insert into public.op_etapas (empresa_id, op_id, setor_id, ordem)
  select new.empresa_id, new.id, s.id, s.ordem from public.setores s
  where s.empresa_id = new.empresa_id and s.ativo order by s.ordem;
  return new;
end $$;
drop trigger if exists op_cria_etapas on public.ordens_producao;
create trigger op_cria_etapas after insert on public.ordens_producao
for each row execute function public.criar_etapas_op();

-- Primeira etapa iniciada → OP passa para "em produção"
create or replace function public.op_em_producao()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status <> 'pendente' then
    update public.ordens_producao set status = 'em_producao'
    where id = new.op_id and status = 'aberta';
  end if;
  return new;
end $$;
drop trigger if exists op_etapa_status on public.op_etapas;
create trigger op_etapa_status after update of status on public.op_etapas
for each row execute function public.op_em_producao();

-- ---------- Materiais (matéria-prima e insumos) ----------
create table if not exists public.materiais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  nome text not null,
  categoria text,
  unidade text not null default 'un' check (unidade in ('par','un','m','m2','kg','g','l','rolo','folha')),
  por_numero boolean not null default false,   -- ex.: solado e palmilha (um por numeração)
  custo numeric(12,4),
  estoque_minimo numeric(12,3),
  fornecedor_id uuid references public.parceiros(id),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, nome)
);

create table if not exists public.material_movimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  material_id uuid not null references public.materiais(id),
  numero int,
  tipo text not null check (tipo in ('entrada','saida','ajuste')),
  quantidade numeric(12,3) not null,
  motivo text,
  compra_id uuid,
  op_id uuid references public.ordens_producao(id) on delete set null,
  observacao text,
  usuario uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  check ((tipo in ('entrada','saida') and quantidade > 0) or (tipo = 'ajuste' and quantidade <> 0))
);
create index if not exists mat_mov_mat on public.material_movimentos(material_id);

create or replace view public.material_saldos with (security_invoker = true) as
select m.material_id, m.empresa_id, m.numero,
       sum(case m.tipo when 'entrada' then m.quantidade when 'saida' then -m.quantidade else m.quantidade end)::numeric(12,3) as saldo
from public.material_movimentos m
group by m.material_id, m.empresa_id, m.numero;

-- ---------- Ficha de consumo: quanto cada par do modelo gasta de cada material ----------
create table if not exists public.ficha_consumo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  material_id uuid not null references public.materiais(id),
  consumo numeric(12,4) not null check (consumo > 0),   -- por PAR, na unidade do material
  perda_pct numeric(5,2) not null default 0 check (perda_pct >= 0),
  observacao text,
  unique (produto_id, material_id)
);

-- ---------- Pedidos de compra ----------
create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  numero bigint generated always as identity,
  fornecedor_id uuid references public.parceiros(id),
  status text not null default 'rascunho' check (status in ('rascunho','enviado','recebido','cancelado')),
  previsao date,
  observacao text,
  recebido_em timestamptz,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.compra_itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  compra_id uuid not null references public.compras(id) on delete cascade,
  material_id uuid not null references public.materiais(id),
  numero int,
  quantidade numeric(12,3) not null check (quantidade > 0),
  custo_unit numeric(12,4) not null default 0
);
create index if not exists compra_itens_compra on public.compra_itens(compra_id);
alter table public.material_movimentos drop constraint if exists material_movimentos_compra_fk;
alter table public.material_movimentos add constraint material_movimentos_compra_fk
  foreign key (compra_id) references public.compras(id) on delete set null;

-- ---------- Concluir OP: entra no estoque de produto e baixa os materiais (uma vez só) ----------
create or replace function public.concluir_op(p_op uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v public.ordens_producao; v_pares int;
begin
  select * into v from public.ordens_producao where id = p_op for update;
  if not found then raise exception 'Ordem não encontrada'; end if;
  if v.status = 'cancelada' then raise exception 'Ordem cancelada não pode ser concluída'; end if;
  if not v.estoque_lancado then
    insert into public.estoque_movimentos (empresa_id, sku_id, tipo, quantidade, motivo, observacao)
    select i.empresa_id, i.sku_id, 'entrada', i.quantidade, 'producao', 'OP-' || lpad(v.numero::text, 4, '0')
    from public.op_itens i where i.op_id = p_op;

    select coalesce(sum(quantidade), 0) into v_pares from public.op_itens where op_id = p_op;

    -- materiais comuns: consumo × pares × (1 + perda)
    insert into public.material_movimentos (empresa_id, material_id, tipo, quantidade, motivo, op_id)
    select f.empresa_id, f.material_id, 'saida', round(f.consumo * v_pares * (1 + f.perda_pct / 100), 3), 'producao', p_op
    from public.ficha_consumo f join public.materiais m on m.id = f.material_id
    where f.produto_id = v.produto_id and not m.por_numero and v_pares > 0;

    -- materiais por numeração (solado, palmilha): por número da grade
    insert into public.material_movimentos (empresa_id, material_id, numero, tipo, quantidade, motivo, op_id)
    select f.empresa_id, f.material_id, s.numero, 'saida', round(f.consumo * i.quantidade * (1 + f.perda_pct / 100), 3), 'producao', p_op
    from public.ficha_consumo f
    join public.materiais m on m.id = f.material_id and m.por_numero
    join public.op_itens i on i.op_id = p_op
    join public.skus s on s.id = i.sku_id
    where f.produto_id = v.produto_id;
  end if;
  update public.op_etapas set status = 'concluida', fim = coalesce(fim, now()) where op_id = p_op and status <> 'concluida';
  update public.ordens_producao set status = 'concluida', estoque_lancado = true, concluida_em = now() where id = p_op;
end $$;

-- ---------- Receber compra: entra no estoque de materiais e atualiza o custo ----------
create or replace function public.receber_compra(p_compra uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v public.compras;
begin
  select * into v from public.compras where id = p_compra for update;
  if not found then raise exception 'Compra não encontrada'; end if;
  if v.status = 'recebido' then return; end if;
  if v.status = 'cancelado' then raise exception 'Compra cancelada'; end if;
  insert into public.material_movimentos (empresa_id, material_id, numero, tipo, quantidade, motivo, compra_id)
  select i.empresa_id, i.material_id, i.numero, 'entrada', i.quantidade, 'compra', p_compra
  from public.compra_itens i where i.compra_id = p_compra;
  update public.materiais m set custo = i.custo_unit
  from public.compra_itens i where i.compra_id = p_compra and i.material_id = m.id and i.custo_unit > 0;
  update public.compras set status = 'recebido', recebido_em = now() where id = p_compra;
end $$;

-- ---------- atualizado_em, histórico, segurança ----------
do $$ declare t text; begin
  foreach t in array array['ordens_producao','materiais','compras'] loop
    execute format('drop trigger if exists %I_atualizado on public.%I', t, t);
    execute format('create trigger %I_atualizado before update on public.%I for each row execute function public.tocar_atualizado()', t, t);
  end loop;
  foreach t in array array['setores','ordens_producao','op_itens','op_etapas','materiais','material_movimentos','ficha_consumo','compras','compra_itens'] loop
    execute format('drop trigger if exists %I_hist on public.%I', t, t);
    execute format('create trigger %I_hist after insert or update or delete on public.%I for each row execute function public.registrar_historico()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_empresa on public.%I', t, t);
    execute format('create policy %I_empresa on public.%I for all to authenticated using (empresa_id = public.minha_empresa()) with check (empresa_id = public.minha_empresa())', t, t);
  end loop;
end $$;

grant select, insert, update, delete on public.setores, public.ordens_producao, public.op_itens, public.op_etapas,
  public.materiais, public.ficha_consumo, public.compras, public.compra_itens to authenticated;
grant select, insert on public.material_movimentos to authenticated;
grant select on public.material_saldos to authenticated;
grant execute on function public.concluir_op(uuid), public.receber_compra(uuid) to authenticated;
revoke execute on function public.concluir_op(uuid), public.receber_compra(uuid) from anon, public;
revoke execute on function public.criar_etapas_op(), public.op_em_producao() from anon, authenticated, public;

-- perfis: admin pode mudar o papel dos usuários da própria empresa (tela Configurações)
create or replace function public.sou_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel = 'admin')
$$;
revoke execute on function public.sou_admin() from anon, public;
grant execute on function public.sou_admin() to authenticated;
drop policy if exists perfil_admin_atualiza on public.perfis;
create policy perfil_admin_atualiza on public.perfis for update to authenticated
  using (empresa_id = public.minha_empresa() and public.sou_admin())
  with check (empresa_id = public.minha_empresa());
grant update (nome, papel) on public.perfis to authenticated;

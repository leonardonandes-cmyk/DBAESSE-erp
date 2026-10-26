-- =====================================================================
-- 005: Clientes/fornecedores (fase 2), Estoque (fase 4), Pedidos (fase 3)
-- e preços no produto. Mesmo padrão: empresa_id + RLS + histórico.
-- =====================================================================

-- ---------- Preços no modelo ----------
alter table public.produtos add column if not exists preco_atacado numeric(10,2);
alter table public.produtos add column if not exists preco_varejo numeric(10,2);

-- ---------- Clientes, revendedoras, fornecedores, transportadoras ----------
create table if not exists public.parceiros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  nome text not null,
  tipos text[] not null default '{cliente}'
    check (tipos <@ array['cliente','revendedora','fornecedor','transportadora']::text[] and cardinality(tipos) > 0),
  documento text,
  telefone text,
  email text,
  cep text,
  endereco text,
  cidade text,
  uf text check (uf is null or uf ~ '^[A-Z]{2}$'),
  canal text,
  observacoes text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists parceiros_documento on public.parceiros(empresa_id, documento) where documento is not null and documento <> '';
create index if not exists parceiros_nome on public.parceiros(empresa_id, lower(nome));

-- ---------- Pedidos ----------
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  numero bigint generated always as identity,
  parceiro_id uuid references public.parceiros(id),
  canal text not null default 'Atacado',
  status text not null default 'orcamento'
    check (status in ('orcamento','aprovado','producao','separacao','faturado','entregue','cancelado')),
  previsao date,
  desconto numeric(10,2) not null default 0,
  observacoes text,
  estoque_baixado boolean not null default false,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists pedidos_status on public.pedidos(empresa_id, status);

create table if not exists public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  sku_id uuid not null references public.skus(id),
  quantidade int not null check (quantidade > 0),
  preco_unit numeric(10,2) not null default 0,
  unique (pedido_id, sku_id)
);
create index if not exists pedido_itens_pedido on public.pedido_itens(pedido_id);

-- ---------- Estoque: toda movimentação fica registrada ----------
create table if not exists public.estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  sku_id uuid not null references public.skus(id),
  tipo text not null check (tipo in ('entrada','saida','ajuste')),
  quantidade int not null,
  motivo text,
  pedido_id uuid references public.pedidos(id),
  observacao text,
  usuario uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  check ((tipo in ('entrada','saida') and quantidade > 0) or (tipo = 'ajuste' and quantidade <> 0))
);
create index if not exists estoque_mov_sku on public.estoque_movimentos(sku_id);
create index if not exists estoque_mov_data on public.estoque_movimentos(empresa_id, criado_em desc);

-- Saldo = entradas − saídas ± ajustes (respeita as regras de acesso de quem consulta)
create or replace view public.estoque_saldos with (security_invoker = true) as
select s.id as sku_id, s.empresa_id, s.produto_id, s.cor_id, s.numero, s.sku,
       coalesce(sum(case m.tipo when 'entrada' then m.quantidade
                                when 'saida' then -m.quantidade
                                else m.quantidade end), 0)::int as saldo
from public.skus s
left join public.estoque_movimentos m on m.sku_id = s.id
group by s.id;

-- ---------- Faturar pedido: muda a situação e dá baixa no estoque (uma vez só) ----------
create or replace function public.faturar_pedido(p_pedido uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v public.pedidos;
begin
  select * into v from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if v.status = 'cancelado' then raise exception 'Pedido cancelado não pode ser faturado'; end if;
  if not v.estoque_baixado then
    insert into public.estoque_movimentos (empresa_id, sku_id, tipo, quantidade, motivo, pedido_id)
    select i.empresa_id, i.sku_id, 'saida', i.quantidade, 'venda', i.pedido_id
    from public.pedido_itens i where i.pedido_id = p_pedido;
  end if;
  update public.pedidos set status = 'faturado', estoque_baixado = true where id = p_pedido;
end $$;

-- Cancelar pedido já faturado devolve o estoque
create or replace function public.cancelar_pedido(p_pedido uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v public.pedidos;
begin
  select * into v from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if v.estoque_baixado then
    insert into public.estoque_movimentos (empresa_id, sku_id, tipo, quantidade, motivo, pedido_id)
    select i.empresa_id, i.sku_id, 'entrada', i.quantidade, 'cancelamento', i.pedido_id
    from public.pedido_itens i where i.pedido_id = p_pedido;
  end if;
  update public.pedidos set status = 'cancelado', estoque_baixado = false where id = p_pedido;
end $$;

-- ---------- atualizado_em automático ----------
do $$ declare t text; begin
  foreach t in array array['parceiros','pedidos'] loop
    execute format('drop trigger if exists %I_atualizado on public.%I', t, t);
    execute format('create trigger %I_atualizado before update on public.%I
                    for each row execute function public.tocar_atualizado()', t, t);
  end loop;
end $$;

-- ---------- Histórico (quem fez, quando, antes/depois) ----------
do $$ declare t text; begin
  foreach t in array array['parceiros','pedidos','pedido_itens','estoque_movimentos'] loop
    execute format('drop trigger if exists %I_hist on public.%I', t, t);
    execute format('create trigger %I_hist after insert or update or delete on public.%I
                    for each row execute function public.registrar_historico()', t, t);
  end loop;
end $$;

-- ---------- Segurança: só a própria empresa ----------
do $$ declare t text; begin
  foreach t in array array['parceiros','pedidos','pedido_itens','estoque_movimentos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_empresa on public.%I', t, t);
    execute format('create policy %I_empresa on public.%I for all to authenticated
                    using (empresa_id = public.minha_empresa())
                    with check (empresa_id = public.minha_empresa())', t, t);
  end loop;
end $$;

grant select, insert, update, delete on public.parceiros, public.pedidos, public.pedido_itens to authenticated;
-- movimento de estoque não se apaga nem se edita: corrige-se com um ajuste
grant select, insert on public.estoque_movimentos to authenticated;
grant select on public.estoque_saldos to authenticated;
grant execute on function public.faturar_pedido(uuid), public.cancelar_pedido(uuid) to authenticated;
revoke execute on function public.faturar_pedido(uuid), public.cancelar_pedido(uuid) from anon, public;

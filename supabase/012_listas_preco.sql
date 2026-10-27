-- 012 · Listas de preço: Atacado, Variado, Drop, Varejo
-- preço = preço-base do modelo (atacado ou varejo) + acréscimo da lista (em R$)
create table if not exists public.listas_preco (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  codigo text not null,
  nome text not null,
  base text not null default 'atacado' check (base in ('atacado','varejo')),
  acrescimo numeric(10,2) not null default 0,
  descricao text,
  ordem int not null default 0,
  unique (empresa_id, codigo)
);
alter table public.listas_preco enable row level security;
drop policy if exists listas_preco_empresa on public.listas_preco;
create policy listas_preco_empresa on public.listas_preco for all to authenticated
  using (empresa_id = public.minha_empresa()) with check (empresa_id = public.minha_empresa());
grant select, insert, update on public.listas_preco to authenticated;
drop trigger if exists listas_preco_hist on public.listas_preco;
create trigger listas_preco_hist after insert or update or delete on public.listas_preco
  for each row execute function public.registrar_historico();

insert into public.listas_preco (empresa_id, codigo, nome, base, acrescimo, descricao, ordem)
select e.id, v.codigo, v.nome, v.base, v.acrescimo, v.descricao, v.ordem
from public.empresas e cross join (values
  ('atacado', 'Atacado', 'atacado', 0, 'Grade fechada · pedido mínimo 6 pares', 1),
  ('variado', 'Variado', 'atacado', 5, 'Compra no variado (sem fechar grade)', 2),
  ('drop',    'Drop',    'atacado', 5, 'Dropshipping', 3),
  ('varejo',  'Varejo',  'varejo',  0, 'Preço FERALCCI · loja, marketplaces e Instagram', 4)
) v(codigo, nome, base, acrescimo, descricao, ordem)
on conflict (empresa_id, codigo) do nothing;

-- lista padrão do cliente e lista usada no pedido
alter table public.parceiros add column if not exists lista text;
alter table public.pedidos add column if not exists lista text;

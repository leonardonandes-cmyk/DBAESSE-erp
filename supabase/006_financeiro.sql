-- 006: Financeiro manual (fase 6) — contas a pagar e a receber
create table if not exists public.titulos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  tipo text not null check (tipo in ('pagar','receber')),
  descricao text not null,
  parceiro_id uuid references public.parceiros(id),
  categoria text,
  valor numeric(12,2) not null check (valor > 0),
  vencimento date not null,
  parcela text,
  pago_em date,
  valor_pago numeric(12,2),
  forma text,
  pedido_id uuid references public.pedidos(id) on delete set null,
  observacao text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists titulos_venc on public.titulos(empresa_id, tipo, vencimento);
create index if not exists titulos_pedido on public.titulos(pedido_id);

drop trigger if exists titulos_atualizado on public.titulos;
create trigger titulos_atualizado before update on public.titulos
for each row execute function public.tocar_atualizado();

drop trigger if exists titulos_hist on public.titulos;
create trigger titulos_hist after insert or update or delete on public.titulos
for each row execute function public.registrar_historico();

alter table public.titulos enable row level security;
drop policy if exists titulos_empresa on public.titulos;
create policy titulos_empresa on public.titulos for all to authenticated
  using (empresa_id = public.minha_empresa())
  with check (empresa_id = public.minha_empresa());

grant select, insert, update, delete on public.titulos to authenticated;

-- 032 · Transportadora no pedido (e a preferida no cadastro do cliente) + frete por conta de quem
alter table public.pedidos add column if not exists transportadora_id uuid references public.parceiros(id) on delete set null,
  add column if not exists frete_por text check (frete_por in ('cliente','empresa'));
alter table public.parceiros add column if not exists transportadora_id uuid references public.parceiros(id) on delete set null;

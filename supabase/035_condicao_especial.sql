-- Condição especial de cliente (ex.: FERALCCI, cliente fundadora)
-- Quando ligada: a lista do cadastro vale em QUALQUER segmento (drop, variado, atacado)
-- e o desconto por par sai de cada par. Vendedora e comissão continuam pelo segmento do pedido.
alter table public.parceiros add column if not exists condicao_especial boolean not null default false;
alter table public.parceiros add column if not exists desconto_par numeric(10,2) not null default 0;
comment on column public.parceiros.condicao_especial is 'Cliente com condição especial: usa a lista do cadastro em todo pedido, menos desconto_par por par';
comment on column public.parceiros.desconto_par is 'Desconto em R$ por par (só com condicao_especial)';

-- só o administrador liga/altera a condição especial
create or replace function public.parceiro_condicao_so_admin() returns trigger language plpgsql set search_path = public as $$
begin
  if (tg_op = 'INSERT' and (new.condicao_especial or new.desconto_par <> 0))
     or (tg_op = 'UPDATE' and (new.condicao_especial is distinct from old.condicao_especial or new.desconto_par is distinct from old.desconto_par or (new.condicao_especial and new.lista is distinct from old.lista))) then
    if not public.sou_admin() then
      raise exception 'Só o administrador altera a condição especial do cliente.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists parceiros_condicao_admin on public.parceiros;
create trigger parceiros_condicao_admin before insert or update on public.parceiros for each row execute function public.parceiro_condicao_so_admin();

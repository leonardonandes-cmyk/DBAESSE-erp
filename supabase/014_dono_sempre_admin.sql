-- 014 · O dono da empresa é SEMPRE administrador (ninguém consegue rebaixar, nem ele mesmo por engano)
alter table public.empresas add column if not exists dono_id uuid references auth.users(id);

update public.empresas e set dono_id = 'e420b603-45d9-4f15-94c2-4b67f0d40a0f'
where e.id = (select empresa_id from public.perfis where id = 'e420b603-45d9-4f15-94c2-4b67f0d40a0f') and e.dono_id is null;

update public.perfis set papel = 'admin' where id = 'e420b603-45d9-4f15-94c2-4b67f0d40a0f';

create or replace function public.dono_sempre_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.papel is distinct from 'admin' and exists (select 1 from public.empresas e where e.dono_id = new.id) then
    raise exception 'O dono da empresa é sempre administrador.';
  end if;
  return new;
end $$;
revoke execute on function public.dono_sempre_admin() from public, anon, authenticated;

drop trigger if exists perfis_dono_admin on public.perfis;
create trigger perfis_dono_admin before insert or update of papel on public.perfis
  for each row execute function public.dono_sempre_admin();

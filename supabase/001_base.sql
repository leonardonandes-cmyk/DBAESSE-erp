-- =====================================================================
-- DBAESSE · Gestão — 001_base.sql  (Fase 1: base + cadastro de produtos)
-- Como usar: Supabase → SQL Editor → New query → colar TUDO → Run.
-- Pode rodar de novo sem estragar nada (usa "if not exists").
-- =====================================================================

-- ---------- Empresas (cada fábrica/marca isolada) ----------
create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  criado_em timestamptz not null default now()
);

insert into public.empresas (nome, slug) values ('DBAESSE', 'dbaesse')
on conflict (slug) do nothing;

-- ---------- Perfis (usuário → empresa + papel) ----------
create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id),
  nome text,
  papel text not null default 'operador' check (papel in ('admin','gestor','operador')),
  criado_em timestamptz not null default now()
);

-- Empresa do usuário logado (usado por todas as regras de acesso)
create or replace function public.minha_empresa()
returns uuid language sql stable security definer set search_path = public as $$
  select empresa_id from public.perfis where id = auth.uid()
$$;

-- Todo usuário criado pelo painel do Supabase entra na DBAESSE como operador.
-- (O cadastro público fica DESLIGADO — só o administrador cria usuários.)
create or replace function public.novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, empresa_id, nome)
  values (new.id, (select id from public.empresas where slug = 'dbaesse'),
          coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
for each row execute function public.novo_usuario();

-- ---------- Cores ----------
create table if not exists public.cores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  nome text not null,
  sigla text not null check (sigla ~ '^[A-Z]{3}$'),
  hex text,
  criado_em timestamptz not null default now(),
  unique (empresa_id, nome),
  unique (empresa_id, sigla)
);

-- ---------- Produtos (modelo) ----------
create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  ref text not null,
  nome text not null,
  tipo text,
  colecao text,
  ncm text,
  grade_de int not null default 34,
  grade_ate int not null default 39,
  status text not null default 'ativo' check (status in ('ativo','rascunho','inativo')),
  foto_url text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, ref)
);

-- ---------- SKUs (modelo + cor + número) ----------
create table if not exists public.skus (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) default public.minha_empresa(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  cor_id uuid not null references public.cores(id),
  numero int not null,
  sku text not null,
  ean text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (empresa_id, sku),
  unique (produto_id, cor_id, numero)
);
create index if not exists skus_produto on public.skus(produto_id);

-- ---------- Histórico: quem fez, quando, antes e depois ----------
create table if not exists public.historico (
  id bigint generated always as identity primary key,
  empresa_id uuid,
  tabela text not null,
  registro_id uuid,
  acao text not null,
  antes jsonb,
  depois jsonb,
  usuario uuid default auth.uid(),
  quando timestamptz not null default now()
);

create or replace function public.registrar_historico()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.historico (empresa_id, tabela, registro_id, acao, antes, depois)
  values (
    coalesce((to_jsonb(new)->>'empresa_id')::uuid, (to_jsonb(old)->>'empresa_id')::uuid),
    tg_table_name,
    coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(old)->>'id')::uuid),
    lower(tg_op),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create or replace function public.tocar_atualizado()
returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;

drop trigger if exists produtos_atualizado on public.produtos;
create trigger produtos_atualizado before update on public.produtos
for each row execute function public.tocar_atualizado();

do $$ declare t text; begin
  foreach t in array array['cores','produtos','skus'] loop
    execute format('drop trigger if exists %I_hist on public.%I', t, t);
    execute format('create trigger %I_hist after insert or update or delete on public.%I
                    for each row execute function public.registrar_historico()', t, t);
  end loop;
end $$;

-- ---------- Segurança: cada um só vê os dados da própria empresa ----------
alter table public.empresas  enable row level security;
alter table public.perfis    enable row level security;
alter table public.cores     enable row level security;
alter table public.produtos  enable row level security;
alter table public.skus      enable row level security;
alter table public.historico enable row level security;

drop policy if exists empresa_ver on public.empresas;
create policy empresa_ver on public.empresas for select to authenticated
  using (id = public.minha_empresa());

drop policy if exists perfil_ver on public.perfis;
create policy perfil_ver on public.perfis for select to authenticated
  using (empresa_id = public.minha_empresa());

do $$ declare t text; begin
  foreach t in array array['cores','produtos','skus'] loop
    execute format('drop policy if exists %I_empresa on public.%I', t, t);
    execute format('create policy %I_empresa on public.%I for all to authenticated
                    using (empresa_id = public.minha_empresa())
                    with check (empresa_id = public.minha_empresa())', t, t);
  end loop;
end $$;

drop policy if exists historico_ver on public.historico;
create policy historico_ver on public.historico for select to authenticated
  using (empresa_id = public.minha_empresa());

-- Libera as tabelas para a API (só usuários logados)
grant usage on schema public to authenticated;
grant select on public.empresas, public.perfis, public.historico to authenticated;
grant select, insert, update, delete on public.cores, public.produtos, public.skus to authenticated;
grant execute on function public.minha_empresa() to authenticated;

-- ---------- Cores iniciais (dá para editar/acrescentar depois) ----------
insert into public.cores (empresa_id, nome, sigla, hex)
select e.id, c.nome, c.sigla, c.hex
from public.empresas e,
(values
  ('Preto','PRE','#1A1A1A'), ('Branco','BRA','#FFFFFF'), ('Off white','OFF','#F2EEE6'),
  ('Nude','NUD','#D9B99B'),  ('Caramelo','CAR','#B07A4A'), ('Marrom','MAR','#5C3A24'),
  ('Bege','BEG','#D8C3A5'),  ('Palha','PAL','#D8C7A0'),    ('Ouro','OUR','#C9A55A'),
  ('Prata','PRA','#C0C0C0'), ('Bordô','BOR','#6E1F2B'),    ('Vermelho','VER','#B3261E'),
  ('Rosa','ROS','#E8B4C0'),  ('Azul','AZU','#2C4A73'),     ('Verde','VRD','#3F5E46'),
  ('Cristal','CRI','#E9EEF0'),('Café','CAF','#4A3428'),    ('Areia','ARE','#CDB89A'),
  ('Mostarda','MOS','#C99A2E')
) as c(nome, sigla, hex)
where e.slug = 'dbaesse'
on conflict do nothing;

-- ---------- Seu usuário vira administrador ----------
-- Depois de criar o seu usuário em Authentication → Users, rode só a linha abaixo
-- trocando o e-mail:
-- update public.perfis set papel = 'admin', nome = 'Leo'
--   where id = (select id from auth.users where email = 'SEU-EMAIL-AQUI');

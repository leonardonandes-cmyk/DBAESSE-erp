-- 015 · Endereço completo do cadastro: número, complemento e bairro separados (endereco = rua)
alter table public.parceiros add column if not exists numero text;
alter table public.parceiros add column if not exists complemento text;
alter table public.parceiros add column if not exists bairro text;

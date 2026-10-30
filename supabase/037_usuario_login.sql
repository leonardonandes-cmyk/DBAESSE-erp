-- 037: login por usuário curto + troca obrigatória da senha provisória (aplicada no Supabase em 30/10)
alter table public.perfis add column if not exists usuario text;
alter table public.perfis add column if not exists trocar_senha boolean not null default false;
create unique index if not exists perfis_usuario_unq on public.perfis (lower(usuario));
create or replace function public.email_do_usuario(u text)
returns text language sql stable security definer set search_path = public, auth as $$
  select au.email from public.perfis p join auth.users au on au.id = p.id
  where lower(p.usuario) = lower(trim(u)) limit 1
$$;
revoke all on function public.email_do_usuario(text) from public;
grant execute on function public.email_do_usuario(text) to anon, authenticated;
create or replace function public.senha_trocada()
returns void language sql security definer set search_path = public as $$
  update public.perfis set trocar_senha = false where id = auth.uid()
$$;
grant execute on function public.senha_trocada() to authenticated;

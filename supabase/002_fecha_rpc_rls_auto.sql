-- 002: a função automática de RLS do Supabase não deve ser chamável pela API
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;

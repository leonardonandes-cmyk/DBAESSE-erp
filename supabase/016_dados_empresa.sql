-- 016 · Dados da empresa (Configurações): razão social, CNPJ, IE, contato e endereço completo
alter table public.empresas
  add column if not exists razao_social text,
  add column if not exists cnpj text,
  add column if not exists ie text,
  add column if not exists telefone text,
  add column if not exists email text,
  add column if not exists cep text,
  add column if not exists endereco text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists uf text;

-- só administrador altera os dados da própria empresa (o dono_id não pode ser trocado pela tela)
drop policy if exists empresa_admin_altera on public.empresas;
create policy empresa_admin_altera on public.empresas for update to authenticated
  using (id = public.minha_empresa() and public.sou_admin())
  with check (id = public.minha_empresa() and public.sou_admin());
grant update (nome, razao_social, cnpj, ie, telefone, email, cep, endereco, numero, complemento, bairro, cidade, uf)
  on public.empresas to authenticated;

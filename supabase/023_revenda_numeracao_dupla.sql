-- 023: produtos de REVENDA (comprados prontos, ex.: EVA da FERALCCI) + numeração dupla (33/34 guardado como 3334)
alter table public.produtos add column if not exists origem text not null default 'propria' check (origem in ('propria','revenda'));
alter table public.produtos add column if not exists custo_compra numeric(12,2);
alter table public.produtos add column if not exists fornecedor_id uuid references public.parceiros(id) on delete set null;

do $$
declare
  v_emp uuid := 'ad21033c-8559-4d32-96bc-92d5d7cfd1f3';
  v_forn uuid;
  v_prod uuid;
  r record;
  c record;
  n int;
begin
  -- FERALCCI passa a ser também fornecedor
  select id into v_forn from public.parceiros where empresa_id = v_emp and lower(nome) = 'feralcci' limit 1;
  if v_forn is not null then
    update public.parceiros set tipos = (select array_agg(distinct t) from unnest(tipos || array['fornecedor']) t) where id = v_forn;
  end if;

  -- cores novas da linha EVA
  insert into public.cores (empresa_id, nome, sigla, hex)
  select v_emp, x.nome, x.sigla, x.hex from (values
    ('Blush','BLS','#E8B4A6'), ('Verde Militar','VMI','#4B5320'), ('Verde Bambu','VBA','#8DA35A'),
    ('Azul BB','ABB','#A9CBEA'), ('Amarelo BB','AMB','#F6E7A1'), ('Pink','PIN','#E0478C'), ('Lilás','LIL','#B79FD3')
  ) as x(nome, sigla, hex)
  where not exists (select 1 from public.cores k where k.empresa_id = v_emp and lower(k.nome) = lower(x.nome));

  -- 320 e 309: revenda, custo R$ 30, grade dupla 33/34 a 39/40, 13 cores
  for r in select * from (values ('320', 'EVA 320', 59.90), ('309', 'EVA 309', 49.90)) as t(ref, nome, varejo) loop
    if exists (select 1 from public.produtos where empresa_id = v_emp and ref = r.ref) then continue; end if;
    insert into public.produtos (empresa_id, ref, nome, tipo, grade_de, grade_ate, status, preco_varejo, origem, custo_compra, fornecedor_id)
    values (v_emp, r.ref, r.nome, 'EVA', 3334, 3940, 'ativo', r.varejo, 'revenda', 30, v_forn)
    returning id into v_prod;
    for c in select id, sigla from public.cores where empresa_id = v_emp and nome in
      ('Preto','Off-White','Blush','Bordô','Verde Militar','Verde Bambu','Caramelo','Marrom','Azul BB','Rosa BB','Amarelo BB','Pink','Lilás') loop
      foreach n in array array[3334, 3536, 3738, 3940] loop
        insert into public.skus (empresa_id, produto_id, cor_id, numero, sku) values (v_emp, v_prod, c.id, n, r.ref || '-' || c.sigla || '-' || n);
      end loop;
    end loop;
  end loop;
end $$;

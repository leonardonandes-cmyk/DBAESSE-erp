-- 020 · PCP: capacidade por setor (pares/dia, padrão 600), sequência da fila de OPs e dias de trabalho
alter table public.setores add column if not exists capacidade_dia int not null default 600 check (capacidade_dia > 0);
update public.setores set capacidade_dia = 600;
alter table public.ordens_producao add column if not exists sequencia int;
alter table public.ordens_producao add column if not exists inicio_programado date;
alter table public.empresas add column if not exists dias_trabalho int[] not null default '{1,2,3,4,5}';

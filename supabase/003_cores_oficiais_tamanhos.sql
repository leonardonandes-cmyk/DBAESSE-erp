-- 003: cores oficiais (mesmas siglas do ETIQUETAS-V2) + tabela BR → USA/EUR
delete from public.cores where empresa_id = (select id from public.empresas where slug='dbaesse');
insert into public.cores (empresa_id, nome, sigla, hex)
select e.id, c.nome, c.sigla, c.hex from public.empresas e,
(values
 ('Caramelo','CAR','#B07A4A'),('Nude','NUD','#D9B99B'),('Off-White','OFW','#F2EEE6'),('Ouro','OUR','#C9A55A'),
 ('Preto','PRE','#1A1A1A'),('Palha','PAL','#D8C7A0'),('Chocolate','CHO','#4A2E22'),('Natural','NAT','#D9C4A3'),
 ('Whisky','WHI','#9A5B2E'),('Branco','BRA','#FFFFFF'),('Prata','PRA','#C0C0C0'),('Dourado','DOU','#C8A24A'),
 ('Marrom','MAR','#5C3A24'),('Bege','BEG','#D8C3A5'),('Bordô','BOR','#6E1F2B'),('Cristal','CRI','#E9EEF0'),
 ('Nude Colorido','NUC','#D9B99B'),('Nude / Caramelo','NCA','#C89A72'),('Off-White / Nude','OFN','#E6D3BE'),
 ('Laranja','LAR','#D9772B'),('Azul','AZU','#2C4A73'),('Nude / Preto / Dourado / Laranja / Azul','NPD','#C8A24A'),
 ('Vermelho','VER','#B3261E'),('Azul / Caramelo / Vermelho','ACV','#8A5A32'),('Bronze','BRO','#8C5A2B'),
 ('Prata / Ouro / Bronze','POB','#BFA46A')
) as c(nome,sigla,hex) where e.slug='dbaesse';

create table if not exists public.tamanhos (br int primary key, usa text not null, eur int not null);
alter table public.tamanhos enable row level security;
drop policy if exists tamanhos_ver on public.tamanhos;
create policy tamanhos_ver on public.tamanhos for select to authenticated using (true);
grant select on public.tamanhos to authenticated;
insert into public.tamanhos values (33,'4',34),(34,'5',35),(35,'6',36),(36,'6.5',37),(37,'7.5',38),(38,'8',39),(39,'9',40),(40,'9.5',41),(41,'10',42)
on conflict (br) do update set usa = excluded.usa, eur = excluded.eur;

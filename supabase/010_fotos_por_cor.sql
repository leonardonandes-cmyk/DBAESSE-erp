-- 010 · Foto de cada cor do modelo
-- produtos.fotos = { "<cor_id>": "<url>" }; produtos.foto_url = foto principal do modelo.
-- As fotos ficam no repositório DBAESSE-catalogo (o mesmo que o catálogo usa), com o nome REF-cor.ext
-- (ex.: 801-caramelo.jpg, brisa-01-palha.jpg). A ligação inicial foi feita casando o nome do arquivo
-- com a REF + nome da cor (359 de 365 combinações; sem arquivo: 104 Off-White, 105 Couro,
-- 410 Caramelo, 425 Caramelo, 429 Caramelo, 429 Preto).
alter table public.produtos add column if not exists fotos jsonb not null default '{}'::jsonb;

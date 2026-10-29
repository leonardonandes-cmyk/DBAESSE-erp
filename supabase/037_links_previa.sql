-- 037 · Prévia do link curto no WhatsApp (título + descrição; a imagem é a capa-pedido.jpg do sistema)
alter table public.documentos_links add column if not exists titulo text;
alter table public.documentos_links add column if not exists descricao text;

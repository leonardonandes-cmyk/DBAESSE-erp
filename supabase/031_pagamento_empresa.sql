-- 031 · Dados de pagamento da empresa (vão no PDF do pedido e na mensagem do WhatsApp)
alter table public.empresas add column if not exists pix_chave text, add column if not exists pagamento_instrucoes text;

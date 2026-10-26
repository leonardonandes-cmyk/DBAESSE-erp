# DBAESSE · Gestão (ERP)

Sistema de gestão da fábrica DBAESSE, construído em casa, módulo por módulo.

## Stack
- React 18 + Vite 5 (mesmo padrão do Clickmargem)
- Publicação: Vercel (o `vercel.json` já cuida das rotas)
- Banco de dados (próxima etapa): Supabase — login, permissões, histórico e backup diário

## Rodar no computador
```
npm install
npm run dev
```

## Estrutura
- `src/styles.css` — tokens de cor/fonte no `:root` (trocar ali para FERALCCI/CLUFF)
- `src/App.jsx` — menu e rotas; a lista `MODULOS` é o mapa das fases
- `src/data/mock.js` — dados de EXEMPLO; será trocado pelo banco num lugar só
- `src/pages/` — uma tela por módulo

## Ordem das fases
1. Base + Produtos (REF, cor, grade, SKU, preços) ✅
2. Clientes, revendedoras, fornecedores e transportadoras ✅
3. Pedidos (orçamento → entrega, faturar baixa estoque) ✅
4. Estoque (entrada de produção, inventário, saldo por número) ✅
5. Produção (ordens por grade, setores, apontamento) — tela de exemplo
6. Financeiro manual
7. Relatórios
8. Compras + ficha técnica (consumo de matéria-prima)
9. Marketplaces (Shopee, TikTok, Mercado Livre)
10. Banco (boleto/Pix)
11. Nota fiscal própria (até lá: UpSeller)

## Banco (Supabase)
Scripts em `supabase/` na ordem (001…005). Já aplicados no projeto dbaesse-erp.
Toda tabela tem empresa_id + regras de acesso (RLS) + histórico (antes/depois).
Movimento de estoque não se apaga: corrige-se com ajuste.

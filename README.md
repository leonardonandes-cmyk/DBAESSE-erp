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
- `src/lib/` — acesso ao banco, um arquivo por módulo
- `src/pages/` — uma tela por módulo

## Ordem das fases
1. Base + Produtos (REF, cor, grade, SKU, preços, ficha técnica) ✅
2. Clientes, revendedoras, fornecedores e transportadoras ✅
3. Pedidos (orçamento → entrega, faturar baixa estoque) ✅
4. Estoque (entrada de produção, inventário, saldo por número) ✅
5. Produção (OP por grade, setores, apontamento, concluir → estoque) ✅
6. Financeiro manual (pagar/receber, parcelas, resumo semanal) ✅
7. Relatórios (vendas, curva ABC, estoque parado, produção, caixa) ✅
8. Compras + ficha de consumo (necessidade de materiais, pedido de compra, recebimento) ✅
9. Marketplaces (Shopee, TikTok, Mercado Livre)
10. Banco (boleto/Pix)
11. Nota fiscal própria (até lá: UpSeller)

Configurações: setores da produção, permissões dos usuários e botão "Baixar backup" (Excel com tudo).

## Banco (Supabase)
Scripts em `supabase/` na ordem (001…013). Já aplicados no projeto dbaesse-erp.
Toda tabela tem empresa_id + regras de acesso (RLS) + histórico (antes/depois).
Movimento de estoque (produto ou material) não se apaga: corrige-se com ajuste.

## Estoque: Bulk e Pick
- **Bulk**: caixas master fechadas (grade fechada). Produção entra aqui.
- **Pick**: pares avulsos para separar pedido variado.
- **Replenishment**: abrir master e passar pares do Bulk para o Pick.
- Faturar tira primeiro do Pick e o que faltar do Bulk; cancelar devolve ao mesmo local.

Toda tela que mostra produto mostra a foto (ou o desenho do tipo): componente `FotoProduto`.

## Ficha técnica e custo
- Ficha por modelo em 5 seções (padrão da planilha FICHA TÉCNICA): cabedal, solado/palmilha, acabamento, mão de obra, custo fixo (rateio).
- Cada linha: material + "gasta X por par" ou "rende X pares por unidade". Custo = cadastro do material (ou custo próprio da linha).
- Materiais têm tipo: material (estoque e compra), mão de obra e custo fixo (só custo).
- Listas de preço têm despesas (% do preço ou R$ por par) e margem-alvo → lucro, margem e preço ideal por modelo.
- Importado da planilha em 27/10/2026: 269 itens da aba MP e as fichas de 85 modelos.

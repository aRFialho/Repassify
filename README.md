# Repassify Enterprise

Base inicial do SaaS de conciliacao financeira de repasses, canais e marketplaces, criada a partir da especificacao Word fornecida.

## Stack

- `apps/web`: Next.js App Router com dashboard operacional, Central de Repasses, Motor de Regras, empresa, usuarios e agente contextual.
- `apps/api`: Fastify REST API com endpoints obrigatorios, JWT, MFA, convites, empresas, regras, importacao, conciliacao e ajuda contextual.
- `packages/core`: tipos de dominio, motor de regras, calculo financeiro e reconciliacao deterministica.
- `packages/db`: `node-postgres`, migrations SQL diretas e helper `withTenant` com `set_config(app.tenant_id)`.
- `db/migrations`: schema Neon PostgreSQL sem Prisma, com RLS e audit logs.
- `workers`: entradas para ingestion, reconciliation e export.

## Comandos

```bash
npm install
npm run build
npm run dev:web
npm run dev:api
```

## Banco

Crie `.env.local` ou variaveis de ambiente com `DATABASE_URL_DIRECT` e execute:

```bash
npm run db:migrate
npm run db:seed
```

## Guardrails do projeto

- Sem Prisma ou ORM.
- Toda query de negocio deve ser parametrizada.
- Toda operacao por tenant deve usar `withTenant`.
- Tabelas de negocio possuem `tenant_id` e RLS.
- Taxas vindas de planilhas/APIs do canal prevalecem sobre qualquer referencia.
- A base inicial de comissoes e apenas informativa para estimativa/revisao.
- A regra fixture obrigatoria Shopee marca auditoria quando frete passa de R$ 50; comissao vem da planilha/API ou de `channel_fee_rules`.

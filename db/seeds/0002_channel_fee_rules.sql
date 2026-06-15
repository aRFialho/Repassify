BEGIN;

SELECT set_config('app.tenant_id', '00000000-0000-4000-8000-000000000001', true);

INSERT INTO channel_fee_rules (
  id,
  tenant_id,
  company_id,
  channel_provider,
  rule_name,
  charge_base,
  percentage_fee,
  percentage_fee_min,
  percentage_fee_max,
  fixed_fee,
  minimum_fee,
  maximum_fee,
  shipping_fee_percent,
  free_period_days,
  effective_from,
  source_url,
  source_confidence,
  rule_origin,
  notes,
  created_by
)
VALUES
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'Mercado Livre', 'Mercado Livre - faixa base 2026', 'product', 19.0000, 10.0000, 19.0000, 0, NULL, NULL, NULL, NULL, '2026-06-15', 'Mercado Livre custos oficiais + Koncili categoria 2026', 'market', 'reference_seed', 'Classico 10%-14%; Premium 15%-19%; custo fixo pode aplicar abaixo de R$ 79.', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'Shopee', 'Shopee - faixa base 2026', 'discounted_product', 20.0000, 12.0000, 20.0000, 0, NULL, NULL, NULL, NULL, '2026-03-01', 'Shopee Seller Center + UpSeller + E-Commerce Brasil', 'market', 'reference_seed', 'Modelo ajustado em 2026; validar por CPF/CNPJ e programa no Seller Center.', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'Amazon', 'Amazon Brasil - faixa por categoria', 'product', 15.0000, 10.0000, 15.0000, 0, 1.00, NULL, NULL, NULL, '2026-06-15', 'Amazon Brasil tarifas oficiais', 'official', 'reference_seed', 'Plano Individual pode ter R$ 2 por item; profissional pode ter mensalidade.', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'Magalu', 'Magalu - promocional novos cadastros', 'product', 9.9000, 9.9000, 9.9000, 0, NULL, NULL, NULL, 90, '2026-06-15', 'Universo Magalu', 'official', 'reference_seed', 'Promocao por 3 meses ou ate R$ 100 mil; regra padrao deve vir de contrato/categoria.', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'Shein', 'Shein Brasil - base publica', 'discounted_product', 16.0000, 16.0000, 16.0000, 0, NULL, NULL, NULL, NULL, '2026-06-15', 'Politica oficial Shein + Nuvemshop', 'market', 'reference_seed', 'Pode haver isencao inicial e ajustes por data/categoria.', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'Americanas', 'Americanas Marketplace - faixa por departamento', 'product', 19.0000, 12.0000, 19.0000, 0, NULL, NULL, NULL, NULL, '2026-06-15', 'Plugg.to + Magis5', 'market', 'reference_seed', 'Validar tabela vigente no Seller Center.', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'Casas Bahia', 'Grupo Casas Bahia - faixa publica', 'product', 21.0000, 18.5000, 21.0000, 0, NULL, NULL, NULL, NULL, '2026-06-15', 'Blog Casas Bahia Marketplace + Nuvemshop', 'market', 'reference_seed', 'Pode variar por contrato, categoria e campanhas promocionais.', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'TikTok Shop', 'TikTok Shop Brasil - taxa base', 'product', 8.0000, 5.0000, 8.0000, 0, NULL, NULL, 6.0000, NULL, '2026-06-15', 'TikTok Seller Academy + Koncili', 'market', 'reference_seed', 'Pode haver taxa de envio e comissao de afiliado definida pelo seller.', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'Carrefour', 'Carrefour Marketplace - referencia publica', 'product_shipping', 16.0000, 16.0000, 16.0000, 0, NULL, NULL, NULL, NULL, '2026-06-15', 'Bling/Carrefour Marketplace', 'partner', 'reference_seed', 'Contrato pode variar por seller.', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'MadeiraMadeira', 'MadeiraMadeira - faixa oficial por categoria', 'product_shipping', 19.0000, 14.5000, 19.0000, 0, NULL, NULL, NULL, NULL, '2026-06-15', 'Universidade MadeiraMadeira', 'official', 'reference_seed', 'Comissao calculada sobre valor total da compra conforme Portal do Lojista.', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'Netshoes', 'Netshoes/Zattini - faixa de referencia', 'product', 30.0000, 15.0000, 30.0000, 0, NULL, NULL, NULL, NULL, '2026-06-15', 'Universo Magalu/Netshoes + Nuvemshop/Koncili', 'market', 'reference_seed', 'Confirmar por contrato; categorias podem passar da faixa base.', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'AliExpress', 'AliExpress Brasil - faixa publica', 'product', 10.0000, 5.0000, 10.0000, 0, NULL, NULL, NULL, NULL, '2026-06-15', 'E-commerce na Pratica + Magis5', 'market', 'reference_seed', 'Varia por categoria; sem mensalidade em fontes publicas.', '00000000-0000-4000-8000-000000000101')
ON CONFLICT DO NOTHING;

INSERT INTO function_docs (id, module, title, objective, prerequisites, steps, common_errors, permissions, acceptance_criteria)
VALUES (
  'fees.channel_rules',
  'Configuracoes',
  'Tabela de Comissoes e Taxas',
  'Versionar regras de comissao por canal, categoria, seller, tipo de anuncio, base de cobranca e periodo de vigencia.',
  '["Tenant ativo", "Canal cadastrado", "Permissao para editar regras financeiras"]'::jsonb,
  '["Escolher canal", "Definir categoria e escopo", "Informar base de cobranca", "Cadastrar percentual e taxas fixas", "Validar fonte", "Ativar vigencia"]'::jsonb,
  '["Regra padrao usada sem categoria", "Fonte de baixa confianca", "Vigencia sobreposta", "Contrato nao importado"]'::jsonb,
  '["create_rule", "activate_rule", "view_values"]'::jsonb,
  '["Nenhuma comissao e calculada por hardcode", "Fallback padrao marca needs_fee_review", "Breakdown salva percentual, taxa fixa, frete, ads e campanha"]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET updated_at = now();

COMMIT;

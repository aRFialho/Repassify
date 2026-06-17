import { createHash } from "node:crypto";
import ExcelJS from "exceljs";

type CellValue = boolean | Date | number | string | null | undefined;

export interface ParsedSpreadsheetRow {
  rowNumber: number;
  values: Record<string, CellValue>;
}

export interface ParsedSpreadsheet {
  headers: string[];
  rows: ParsedSpreadsheetRow[];
  sha256: string;
}

export interface ImportPayout {
  payoutNumber: string;
  channel: string;
  periodStart: string;
  periodEnd: string;
  expectedAmount: number;
  receivedAmount: number;
  differenceAmount: number;
  retainedAmount: number;
  status: string;
  components: Record<string, unknown>;
  sourceRows: number[];
}

export interface ImportIssue {
  issueType: string;
  severity: "low" | "medium" | "high" | "critical";
  amountImpact: number;
  explanation: string;
  evidence: Array<{ label: string; value: unknown }>;
}

export interface PreparedImport {
  detectedTemplate: string;
  mapping: Record<string, string>;
  rawRows: ParsedSpreadsheetRow[];
  payouts: ImportPayout[];
  issuesByPayout: Map<string, ImportIssue[]>;
  stats: Record<string, unknown>;
  errors: Array<{ rowNumber: number; message: string }>;
}

interface ReconciliationLaunchRow {
  rowNumber: number;
  conciliationId: string;
  orderNumber: string;
  referenceNumber: string;
  channel: string;
  account: string;
  orderDate: string;
  expectedDate: string;
  settlementDate: string;
  installment: string;
  launchName: string;
  category: string;
  financialFunction: string;
  financialGroup: string;
  expectedAmount: number;
  receivedAmount: number;
  differenceAmount: number;
  stage: string;
  status: string;
  critique: string;
  origin: string;
  paymentReference: string;
}

const channelNames = [
  "Shopee",
  "Mercado Livre",
  "Amazon",
  "Magalu",
  "Shein",
  "Americanas",
  "Casas Bahia",
  "TikTok Shop",
  "Carrefour",
  "MadeiraMadeira",
  "Netshoes",
  "AliExpress"
];

const aliases: Record<string, string[]> = {
  conciliationId: ["conciliacao", "conciliação"],
  orderNumber: [
    "pedido",
    "numero do pedido",
    "n pedido",
    "order",
    "order id",
    "order number",
    "id pedido",
    "ref pedido",
    "ref_pedido",
    "id integrador",
    "id_integrador",
    "id do pedido"
  ],
  payoutNumber: ["payout", "lote", "settlement id", "liquidacao id", "numero repasse", "payout id", "id repasse"],
  channel: ["canal", "marketplace", "plataforma", "origem", "source"],
  company: ["empresa", "loja", "conta", "nome de usuario vendedor", "seller account", "seller username"],
  account: ["conta", "nome de usuario vendedor", "seller account", "seller username"],
  orderDate: ["data pedido", "data do pedido", "data de criacao do pedido", "data criacao pedido", "order date"],
  expectedDate: ["data prevista", "data_previsao", "expected date"],
  settlementDate: [
    "data repasse",
    "data de repasse",
    "data_repasse",
    "data liquidacao",
    "settlement date",
    "paid date",
    "data pagamento",
    "data de conclusao do pagamento"
  ],
  periodStart: ["periodo inicio", "inicio periodo", "period start", "data inicial"],
  periodEnd: ["periodo fim", "fim periodo", "period end", "data final"],
  grossAmount: [
    "bruto",
    "valor bruto",
    "gross",
    "gross amount",
    "valor produto",
    "preco do produto",
    "subtotal de mercadoria",
    "quantia total lancada"
  ],
  feeAmount: [
    "comissao",
    "comissao marketplace",
    "fee",
    "fees",
    "commission",
    "taxa de comissao liquida",
    "taxa de servico liquida",
    "taxa de transacao",
    "taxa de comissao afiliados do vendedor"
  ],
  shippingAmount: ["frete", "shipping", "envio", "taxa frete", "shipping fee"],
  adsAmount: ["ads", "publicidade", "anuncios", "campanha", "marketing"],
  refundAmount: ["valor do reembolso", "valor reembolsado", "devolucao", "estorno", "refund amount", "chargeback"],
  retainedAmount: ["retido", "saldo retido", "reserva", "retained", "bloqueado"],
  expectedAmount: ["esperado", "valor esperado", "expected", "expected net", "liquido esperado", "valor previsto"],
  receivedAmount: [
    "liquido",
    "valor liquido",
    "net",
    "net amount",
    "recebido",
    "valor recebido",
    "repasse liquido",
    "valor repasse"
  ],
  differenceAmount: ["diferenca", "diferença", "difference"],
  installment: ["parcela", "n parcela", "n_parcela", "parcelamento"],
  totalInstallments: ["qt parcelas", "qt_parcelas", "total parcelas"],
  launchName: ["lancamento", "lançamento", "tipo lancamento", "tipo de lancamento", "tp lancamento", "tp_lancamento"],
  stage: ["etapa", "status conciliacao", "status conciliação"],
  critique: ["critica", "crítica", "motivo", "observacao", "observação"],
  origin: ["origem"],
  paymentReference: ["pagamentos", "referencia pagamento", "referência pagamento"],
  financialFunction: ["funcao financeira", "função financeira"],
  financialGroup: ["agrupamento financeiro"],
  financialCategory: ["categoria financeira"]
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseMoney(value: CellValue) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return roundMoney(value);
  }

  const raw = String(value ?? "").trim();
  if (!raw) {
    return 0;
  }

  const negative = raw.includes("(") && raw.includes(")") ? -1 : raw.startsWith("-") ? -1 : 1;
  let text = raw.replace(/[R$\s()]/gi, "").replace(/[^\d,.-]/g, "");
  text = text.replace(/^-/, "");

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  const decimalSeparator = lastComma > lastDot ? "," : ".";
  const thousandsSeparator = decimalSeparator === "," ? "." : ",";

  text = text.split(thousandsSeparator).join("");
  if (decimalSeparator === ",") {
    text = text.replace(",", ".");
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? roundMoney(parsed * negative) : 0;
}

function parseDate(value: CellValue, fallback: string) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const parsed = new Date(excelEpoch + value * 24 * 60 * 60 * 1000);
    return parsed.toISOString().slice(0, 10);
  }

  const raw = String(value ?? "").trim();
  if (!raw) {
    return fallback;
  }

  const iso = raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2]?.padStart(2, "0")}-${iso[3]?.padStart(2, "0")}`;
  }

  const br = raw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (br) {
    const year = br[3]?.length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2]?.padStart(2, "0")}-${br[1]?.padStart(2, "0")}`;
  }

  return fallback;
}

function scoreHeaderRow(row: CellValue[]) {
  const normalizedAliases = Object.values(aliases).flat().map(normalizeText);
  const normalizedCells = row.map((cell) => normalizeText(String(cell ?? ""))).filter(Boolean);
  const recognized = normalizedCells.filter((cell) =>
    normalizedAliases.some((alias) => cell === alias || cell.includes(alias) || alias.includes(cell))
  ).length;
  return recognized * 100 + normalizedCells.length;
}

function detectMapping(headers: string[]) {
  const normalizedHeaders = headers.map((header) => ({ header, normalized: normalizeText(header) }));
  const mapping: Record<string, string> = {};

  for (const [field, fieldAliases] of Object.entries(aliases)) {
    const normalizedAliases = fieldAliases.map(normalizeText);
    const exact = normalizedHeaders.find((item) => normalizedAliases.includes(item.normalized));
    const fuzzy =
      exact ??
      normalizedHeaders.find((item) =>
        normalizedAliases.some(
          (alias) => item.normalized.includes(alias) || (item.normalized.length >= 4 && alias.includes(item.normalized))
        )
      );

    if (fuzzy) {
      mapping[field] = fuzzy.header;
    }
  }

  return mapping;
}

function getMapped(row: ParsedSpreadsheetRow, mapping: Record<string, string>, field: string) {
  const header = mapping[field];
  return header ? row.values[header] : undefined;
}

function detectChannel(sourceName: string, fileName: string, value: CellValue) {
  const haystack = normalizeText(`${String(value ?? "")} ${sourceName} ${fileName}`);
  return channelNames.find((channel) => haystack.includes(normalizeText(channel))) ?? "Canal importado";
}

function canonicalFinancialCategory(value: CellValue, launchName: string) {
  const normalized = normalizeText(`${String(value ?? "")} ${launchName}`);

  if (normalized.includes("legado")) return "Legado";
  if (normalized.includes("venda") || normalized.includes("sale")) return "Venda";
  if (normalized.includes("comissao") || normalized.includes("commission") || normalized.includes("servico")) {
    return "Comissao";
  }
  if (normalized.includes("frete") || normalized.includes("logistica") || normalized.includes("shipping")) {
    return "Frete e Logistica";
  }
  if (
    normalized.includes("campanha") ||
    normalized.includes("propaganda") ||
    normalized.includes("promocao") ||
    normalized.includes("promotion") ||
    normalized.includes("cupom") ||
    normalized.includes("voucher") ||
    normalized.includes("afiliado")
  ) {
    return "Campanha";
  }

  return "Outros";
}

function inferShopeeLaunchFromHeader(header: string) {
  const normalized = normalizeText(header);
  const ignored = [
    "numero da sequencia",
    "ver",
    "id do pedido",
    "id do reembolso",
    "sku",
    "nome do produto",
    "data de criacao do pedido",
    "data de conclusao do pagamento",
    "canal de liberacao",
    "tipo de pedido",
    "hot listing",
    "nome de usuario comprador",
    "quantia paga pelo comprador",
    "metodo de pagamento do comprador",
    "parcelamento se aplicavel",
    "transportadora",
    "nome da transportadora",
    "tipo de estoque",
    "codigo do cupom",
    "quantia total lancada"
  ];

  if (!normalized || ignored.includes(normalized) || normalized.includes("bruta")) {
    return null;
  }

  if (normalized.includes("frete cobrado pelo parceiro logistico")) {
    return { launchName: "Frete", category: "Legado" };
  }

  if (normalized.includes("preco do produto")) {
    return { launchName: "Venda", category: "Venda" };
  }

  if (normalized.includes("valor do reembolso") || normalized.includes("valor reembolsado ao comprador")) {
    return { launchName: "Reembolso", category: "Venda" };
  }

  if (normalized.includes("taxa de frete paga pelo comprador")) {
    return { launchName: "Taxa de frete paga pelo comprador", category: "Frete e Logistica" };
  }

  if (normalized.includes("desconto de frete pela shopee")) {
    return { launchName: "Desconto de frete pela Shopee", category: "Frete e Logistica" };
  }

  if (normalized.includes("taxa de devolucao facil") || normalized.includes("taxa de envio reverso") || normalized.includes("taxa de devolucao do vendedor")) {
    return { launchName: header, category: "Outros" };
  }

  if (normalized.includes("incentivo de cupom")) {
    return { launchName: header, category: "Outros" };
  }

  if (normalized.includes("ajuste por pagamento via pix")) {
    return { launchName: "Desconto de promocao", category: "Campanha" };
  }

  if (normalized.includes("ajuste por participacao em acao comercial")) {
    return null;
  }

  if (
    normalized.includes("taxa de comissao") ||
    normalized.includes("taxa de servico") ||
    normalized.includes("taxa de transacao") ||
    normalized.includes("taxa por item vendido") ||
    normalized.includes("taxa da recarga automatica")
  ) {
    return { launchName: normalized.includes("afiliados") ? "Taxa de comissao afiliados do vendedor" : "Comissao", category: "Comissao" };
  }

  if (
    normalized.includes("cupom") ||
    normalized.includes("voucher") ||
    normalized.includes("coin cashback") ||
    normalized.includes("promocao") ||
    normalized.includes("incentivo") ||
    normalized.includes("acao comercial") ||
    normalized.includes("desconto")
  ) {
    return { launchName: header, category: "Campanha" };
  }

  if (
    normalized.includes("ajuste") ||
    normalized.includes("compensacao") ||
    normalized.includes("perdida") ||
    normalized.includes("moedas resgatadas")
  ) {
    return { launchName: header, category: "Outros" };
  }

  return null;
}

function deriveLaunchStatuses(input: {
  expectedAmount: number;
  receivedAmount: number;
  differenceAmount: number;
  hasExplicitDifference: boolean;
  critique: string;
  stage: string;
}) {
  const normalizedCritique = normalizeText(input.critique);
  const statuses = new Set<string>();

  if ((input.hasExplicitDifference && Math.abs(input.differenceAmount) > 0.01) || normalizedCritique.includes("nao confere")) {
    statuses.add("Divergencia");
  }

  if (normalizedCritique.includes("duplicidade")) {
    statuses.add("Duplicado");
  }

  if (
    normalizedCritique.includes("nao pode ser previsto") ||
    (!statuses.has("Duplicado") && Math.abs(input.expectedAmount) <= 0.01 && Math.abs(input.receivedAmount) > 0.01)
  ) {
    statuses.add("Nao previsto");
  }

  if (!statuses.size) {
    statuses.add(input.stage || "Conciliado");
  }

  return [...statuses];
}

function incrementSummary<T extends Record<string, unknown>>(map: Map<string, T>, key: string, seed: T, update: (item: T) => void) {
  const item = map.get(key) ?? seed;
  update(item);
  map.set(key, item);
}

function severityFromAmount(amount: number): ImportIssue["severity"] {
  const absolute = Math.abs(amount);
  if (absolute >= 1000) return "high";
  if (absolute >= 100) return "medium";
  return "low";
}

function pushIssue(
  map: Map<string, ImportIssue[]>,
  payoutNumber: string,
  issue: ImportIssue
) {
  const current = map.get(payoutNumber) ?? [];
  current.push(issue);
  map.set(payoutNumber, current);
}

function parseDelimitedText(text: string) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) ?? "";
  const delimiter = [";", "\t", ","].sort(
    (left, right) => firstLine.split(right).length - firstLine.split(left).length
  )[0] ?? ",";
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === delimiter && !quoted) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char ?? "";
  }

  if (current || row.length) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

function cellToValue(cell: ExcelJS.Cell): CellValue {
  const value = cell.value;
  if (value instanceof Date || typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (value && typeof value === "object") {
    if ("result" in value) return value.result as CellValue;
    if ("text" in value) return String(value.text ?? "");
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text).join("");
    }
  }

  return cell.text || "";
}

async function readMatrix(buffer: Buffer, fileName: string): Promise<CellValue[][]> {
  const lowerFileName = fileName.toLowerCase();

  if (lowerFileName.endsWith(".xls") && !lowerFileName.endsWith(".xlsx")) {
    throw new Error("Arquivos .xls antigos nao sao suportados. Salve a planilha como .xlsx ou .csv e envie novamente.");
  }

  if (lowerFileName.endsWith(".csv") || lowerFileName.endsWith(".tsv") || lowerFileName.endsWith(".txt")) {
    return parseDelimitedText(buffer.toString("utf8"));
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  let worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("A planilha nao possui abas para importacao.");
  }

  let bestScore = -1;
  for (const candidate of workbook.worksheets) {
    const maxCandidateColumn = Math.max(candidate.actualColumnCount, candidate.columnCount, 1);
    const rowsToInspect = Math.min(candidate.actualRowCount, 30);

    for (let rowIndex = 1; rowIndex <= rowsToInspect; rowIndex += 1) {
      const row = candidate.getRow(rowIndex);
      const values: CellValue[] = [];
      for (let column = 1; column <= maxCandidateColumn; column += 1) {
        values.push(cellToValue(row.getCell(column)));
      }

      const score = scoreHeaderRow(values);
      if (score > bestScore) {
        bestScore = score;
        worksheet = candidate;
      }
    }
  }

  const maxColumn = Math.max(worksheet.actualColumnCount, worksheet.columnCount, 1);
  const matrix: CellValue[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values: CellValue[] = [];
    for (let column = 1; column <= maxColumn; column += 1) {
      values.push(cellToValue(row.getCell(column)));
    }
    matrix.push(values);
  });

  return matrix;
}

export async function parseSpreadsheetBuffer(buffer: Buffer, fileName: string): Promise<ParsedSpreadsheet> {
  const matrix = await readMatrix(buffer, fileName);
  const scoredRows = matrix.map((row, index) => ({ index, score: scoreHeaderRow(row) }));
  const bestScoredRow = scoredRows.sort((left, right) => right.score - left.score)[0];
  const headerIndex =
    bestScoredRow && bestScoredRow.score > 0
      ? bestScoredRow.index
      : matrix.findIndex((row) => row.some((cell) => String(cell ?? "").trim()));

  if (headerIndex < 0) {
    throw new Error("A planilha esta vazia.");
  }

  const seenHeaders = new Map<string, number>();
  const headers = matrix[headerIndex]!.map((cell, index) => {
    const baseHeader = String(cell || `Coluna ${index + 1}`).trim();
    const normalizedHeader = normalizeText(baseHeader) || `coluna ${index + 1}`;
    const count = (seenHeaders.get(normalizedHeader) ?? 0) + 1;
    seenHeaders.set(normalizedHeader, count);
    return count === 1 ? baseHeader : `${baseHeader} #${count}`;
  });
  const rows = matrix
    .slice(headerIndex + 1)
    .map((row, rowIndex) => ({
      rowNumber: headerIndex + rowIndex + 2,
      values: Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))
    }))
    .filter((row) => Object.values(row.values).some((value) => String(value ?? "").trim()));

  return {
    headers,
    rows,
    sha256: createHash("sha256").update(buffer).digest("hex")
  };
}

export async function prepareSpreadsheetReconciliation(input: {
  buffer: Buffer;
  fileName: string;
  sourceName: string;
}): Promise<PreparedImport> {
  const parsed = await parseSpreadsheetBuffer(input.buffer, input.fileName);
  const mapping = detectMapping(parsed.headers);
  const today = new Date().toISOString().slice(0, 10);
  const grouped = new Map<string, ImportPayout>();
  const issuesByPayout = new Map<string, ImportIssue[]>();
  const errors: PreparedImport["errors"] = [];
  const launchRows: ReconciliationLaunchRow[] = [];

  for (const row of parsed.rows) {
    const channel = detectChannel(input.sourceName, input.fileName, getMapped(row, mapping, "channel"));
    const orderNumber = String(getMapped(row, mapping, "orderNumber") ?? "").trim();
    const conciliationId = String(getMapped(row, mapping, "conciliationId") ?? "").trim();
    const rawPayoutNumber = String(getMapped(row, mapping, "payoutNumber") ?? "").trim();
    const payoutNumber =
      rawPayoutNumber || (conciliationId ? `CONC-${conciliationId}` : orderNumber || `IMP-${parsed.sha256.slice(0, 10)}-${row.rowNumber}`);
    const launchName = String(getMapped(row, mapping, "launchName") ?? "").trim();
    const financialCategory = canonicalFinancialCategory(getMapped(row, mapping, "financialCategory"), launchName);
    const financialFunction = String(getMapped(row, mapping, "financialFunction") ?? "").trim();
    const financialGroup = String(getMapped(row, mapping, "financialGroup") ?? "").trim();
    const account = String(getMapped(row, mapping, "account") ?? getMapped(row, mapping, "company") ?? "").trim();
    const stage = String(getMapped(row, mapping, "stage") ?? "").trim();
    const critique = String(getMapped(row, mapping, "critique") ?? "").trim();
    const origin = String(getMapped(row, mapping, "origin") ?? "").trim();
    const paymentReference = String(getMapped(row, mapping, "paymentReference") ?? "").trim();
    const rowKind = normalizeText(String(row.values.Ver ?? ""));
    const installment = [
      String(getMapped(row, mapping, "installment") ?? "").trim(),
      String(getMapped(row, mapping, "totalInstallments") ?? "").trim()
    ]
      .filter(Boolean)
      .join("/");
    const gross = Math.abs(parseMoney(getMapped(row, mapping, "grossAmount")));
    const fee = Math.abs(parseMoney(getMapped(row, mapping, "feeAmount")));
    const shipping = Math.abs(parseMoney(getMapped(row, mapping, "shippingAmount")));
    const ads = Math.abs(parseMoney(getMapped(row, mapping, "adsAmount")));
    const refund = Math.abs(parseMoney(getMapped(row, mapping, "refundAmount")));
    const retained = Math.abs(parseMoney(getMapped(row, mapping, "retainedAmount")));
    const explicitExpected = parseMoney(getMapped(row, mapping, "expectedAmount"));
    const explicitReceived = parseMoney(getMapped(row, mapping, "receivedAmount"));
    const explicitDifference = parseMoney(getMapped(row, mapping, "differenceAmount"));
    const hasLaunchAmounts = Boolean(launchName || mapping.financialCategory) && (explicitExpected || explicitReceived);
    const expected = explicitExpected || (gross ? roundMoney(gross - fee - shipping - ads - refund) : explicitReceived);
    const received = explicitReceived || expected;
    const rowDifference = mapping.differenceAmount ? explicitDifference : roundMoney(received - expected);
    const date = parseDate(getMapped(row, mapping, "settlementDate"), today);
    const orderDate = parseDate(getMapped(row, mapping, "orderDate"), "");
    const expectedDate = parseDate(getMapped(row, mapping, "expectedDate"), "");
    const periodStart = parseDate(getMapped(row, mapping, "periodStart"), date);
    const periodEnd = parseDate(getMapped(row, mapping, "periodEnd"), date);

    if (!gross && !received && !hasLaunchAmounts) {
      errors.push({ rowNumber: row.rowNumber, message: "Linha sem valor bruto ou liquido identificado." });
    }

    if (launchName || mapping.financialCategory) {
      const launchStatuses = deriveLaunchStatuses({
        expectedAmount: explicitExpected,
        receivedAmount: explicitReceived || explicitExpected,
        differenceAmount: rowDifference,
        hasExplicitDifference: Boolean(mapping.differenceAmount),
        critique,
        stage
      });
      launchRows.push({
        rowNumber: row.rowNumber,
        conciliationId,
        orderNumber,
        referenceNumber: String(getMapped(row, mapping, "orderNumber") ?? "").trim(),
        channel,
        account,
        orderDate,
        expectedDate,
        settlementDate: date,
        installment,
        launchName: launchName || financialCategory,
        category: financialCategory,
        financialFunction,
        financialGroup,
        expectedAmount: explicitExpected,
        receivedAmount: explicitReceived || explicitExpected,
        differenceAmount: rowDifference,
        stage: stage || "Conciliado",
        status: launchStatuses.join(", "),
        critique,
        origin,
        paymentReference
      });
    } else if (detectChannel(input.sourceName, input.fileName, getMapped(row, mapping, "channel")) === "Shopee" && (!rowKind || rowKind === "order")) {
      for (const [header, value] of Object.entries(row.values)) {
        const inferredLaunch = inferShopeeLaunchFromHeader(header);
        if (!inferredLaunch) {
          continue;
        }

        const amount = parseMoney(value);
        if (Math.abs(amount) <= 0.01) {
          continue;
        }

        launchRows.push({
          rowNumber: row.rowNumber,
          conciliationId,
          orderNumber,
          referenceNumber: orderNumber,
          channel,
          account,
          orderDate,
          expectedDate,
          settlementDate: date,
          installment,
          launchName: inferredLaunch.launchName,
          category: inferredLaunch.category,
          financialFunction: amount >= 0 ? "Receita" : inferredLaunch.category === "Legado" ? "Legado" : "Despesas Operacionais",
          financialGroup: `${amount >= 0 ? "Receita" : inferredLaunch.category === "Legado" ? "Outros" : "Despesas"} - ${inferredLaunch.category}`,
          expectedAmount: amount,
          receivedAmount: amount,
          differenceAmount: 0,
          stage: "Conciliado",
          status: "Conciliado",
          critique: "Lancamento identificado a partir da planilha original da Shopee.",
          origin: "Planilha Shopee",
          paymentReference: orderNumber
        });
      }
    }

    const current =
      grouped.get(payoutNumber) ??
      ({
        payoutNumber,
        channel,
        periodStart,
        periodEnd,
        expectedAmount: 0,
        receivedAmount: 0,
        differenceAmount: 0,
        retainedAmount: 0,
        status: "conciliated",
        components: {
          gross: 0,
          fee: 0,
          shipping: 0,
          shippingCredit: 0,
          ads: 0,
          refund: 0,
          legacy: 0,
          otherCredits: 0,
          otherDebits: 0,
          margin: 0,
          orderNumbers: [],
          feeSource: fee ? "spreadsheet" : "missing",
          sourceFile: input.fileName
        },
        sourceRows: []
      } satisfies ImportPayout);

    current.expectedAmount = roundMoney(current.expectedAmount + expected);
    current.receivedAmount = roundMoney(current.receivedAmount + received);
    current.retainedAmount = roundMoney(current.retainedAmount + retained);
    current.periodStart = current.periodStart < periodStart ? current.periodStart : periodStart;
    current.periodEnd = current.periodEnd > periodEnd ? current.periodEnd : periodEnd;
    current.sourceRows.push(row.rowNumber);
    current.components = {
      ...current.components,
      gross: roundMoney(Number(current.components.gross) + gross),
      fee: roundMoney(Number(current.components.fee) + fee),
      shipping: roundMoney(Number(current.components.shipping) + shipping),
      ads: roundMoney(Number(current.components.ads) + ads),
      refund: roundMoney(Number(current.components.refund) + refund),
      margin: roundMoney(Number(current.components.margin) + gross - fee - shipping - ads - refund),
      orderNumbers: orderNumber
        ? [...((current.components.orderNumbers as string[]) ?? []), orderNumber]
        : current.components.orderNumbers
    };

    if (launchName || mapping.financialCategory) {
      const launchAmount = explicitReceived || explicitExpected;
      const amountAbs = Math.abs(launchAmount);
      const isPositive = launchAmount >= 0;
      current.components = {
        ...current.components,
        gross:
          financialCategory === "Venda"
            ? roundMoney(Number(current.components.gross) + Math.max(launchAmount, 0))
            : current.components.gross,
        fee:
          financialCategory === "Comissao"
            ? roundMoney(Number(current.components.fee) + amountAbs)
            : current.components.fee,
        shipping:
          financialCategory === "Frete e Logistica" && !isPositive
            ? roundMoney(Number(current.components.shipping) + amountAbs)
            : current.components.shipping,
        shippingCredit:
          financialCategory === "Frete e Logistica" && isPositive
            ? roundMoney(Number(current.components.shippingCredit) + launchAmount)
            : current.components.shippingCredit,
        ads:
          financialCategory === "Campanha"
            ? roundMoney(Number(current.components.ads) + amountAbs)
            : current.components.ads,
        legacy:
          financialCategory === "Legado"
            ? roundMoney(Number(current.components.legacy) + launchAmount)
            : current.components.legacy,
        otherCredits:
          financialCategory === "Outros" && isPositive
            ? roundMoney(Number(current.components.otherCredits) + launchAmount)
            : current.components.otherCredits,
        otherDebits:
          financialCategory === "Outros" && !isPositive
            ? roundMoney(Number(current.components.otherDebits) + amountAbs)
            : current.components.otherDebits,
        margin: roundMoney(Number(current.components.margin) + launchAmount)
      };
    }

    grouped.set(payoutNumber, current);

    if (!mapping.feeAmount && gross && !launchName) {
      pushIssue(issuesByPayout, payoutNumber, {
        issueType: "needs_fee_review",
        severity: "medium",
        amountImpact: 0,
        explanation: "A planilha nao trouxe coluna de taxas/comissao. O repasse precisa de revisao antes do fechamento.",
        evidence: [
          { label: "linha", value: row.rowNumber },
          { label: "arquivo", value: input.fileName }
        ]
      });
    }

    if (fee > gross && gross > 0) {
      pushIssue(issuesByPayout, payoutNumber, {
        issueType: "fee_above_gross",
        severity: "high",
        amountImpact: fee - gross,
        explanation: "A taxa identificada e maior que o valor bruto da venda.",
        evidence: [
          { label: "linha", value: row.rowNumber },
          { label: "bruto", value: gross },
          { label: "taxa", value: fee }
        ]
      });
    }

    if (retained > 0) {
      pushIssue(issuesByPayout, payoutNumber, {
        issueType: "retained_amount",
        severity: severityFromAmount(retained),
        amountImpact: retained,
        explanation: "A planilha informou valor retido/bloqueado no repasse.",
        evidence: [
          { label: "linha", value: row.rowNumber },
          { label: "retido", value: retained }
        ]
      });
    }
  }

  for (const payout of grouped.values()) {
    payout.differenceAmount = roundMoney(payout.receivedAmount - payout.expectedAmount);
    payout.status = Math.abs(payout.differenceAmount) <= 0.01 ? "conciliated" : "divergent";

    if (Math.abs(payout.differenceAmount) > 0.01) {
      pushIssue(issuesByPayout, payout.payoutNumber, {
        issueType: payout.differenceAmount < 0 ? "underpaid_payout" : "overpaid_payout",
        severity: severityFromAmount(payout.differenceAmount),
        amountImpact: Math.abs(payout.differenceAmount),
        explanation:
          payout.differenceAmount < 0
            ? "Valor recebido menor que o liquido esperado calculado pela planilha."
            : "Valor recebido maior que o liquido esperado calculado pela planilha.",
        evidence: [
          { label: "repasse", value: payout.payoutNumber },
          { label: "esperado", value: payout.expectedAmount },
          { label: "recebido", value: payout.receivedAmount },
          { label: "diferenca", value: payout.differenceAmount }
        ]
      });
    }
  }

  const payouts = [...grouped.values()];
  const totals = payouts.reduce(
    (acc, payout) => ({
      expectedAmount: roundMoney(acc.expectedAmount + payout.expectedAmount),
      receivedAmount: roundMoney(acc.receivedAmount + payout.receivedAmount),
      differenceAmount: roundMoney(acc.differenceAmount + payout.differenceAmount),
      retainedAmount: roundMoney(acc.retainedAmount + payout.retainedAmount)
    }),
    { expectedAmount: 0, receivedAmount: 0, differenceAmount: 0, retainedAmount: 0 }
  );
  const categoryMap = new Map<
    string,
    {
      category: string;
      count: number;
      revenueNet: number;
      expenseNet: number;
      finalAmount: number;
      expenseWeightPct: number;
    }
  >();
  const launchMap = new Map<
    string,
    {
      launchName: string;
      category: string;
      count: number;
      expectedAmount: number;
      receivedAmount: number;
      differenceAmount: number;
    }
  >();
  const statusMap = new Map<string, { status: string; count: number }>();

  for (const launch of launchRows) {
    incrementSummary(
      categoryMap,
      launch.category,
      { category: launch.category, count: 0, revenueNet: 0, expenseNet: 0, finalAmount: 0, expenseWeightPct: 0 },
      (item) => {
        item.count = Number(item.count) + 1;
        item.revenueNet = roundMoney(Number(item.revenueNet) + (launch.receivedAmount > 0 ? launch.receivedAmount : 0));
        item.expenseNet = roundMoney(Number(item.expenseNet) + (launch.receivedAmount < 0 ? launch.receivedAmount : 0));
        item.finalAmount = roundMoney(Number(item.finalAmount) + launch.receivedAmount);
      }
    );

    incrementSummary(
      launchMap,
      launch.launchName,
      {
        launchName: launch.launchName,
        category: launch.category,
        count: 0,
        expectedAmount: 0,
        receivedAmount: 0,
        differenceAmount: 0
      },
      (item) => {
        item.count = Number(item.count) + 1;
        item.expectedAmount = roundMoney(Number(item.expectedAmount) + launch.expectedAmount);
        item.receivedAmount = roundMoney(Number(item.receivedAmount) + launch.receivedAmount);
        item.differenceAmount = roundMoney(Number(item.differenceAmount) + launch.differenceAmount);
      }
    );

    for (const status of launch.status.split(",").map((item) => item.trim()).filter(Boolean)) {
      incrementSummary(statusMap, status, { status, count: 0 }, (item) => {
        item.count = Number(item.count) + 1;
      });
    }
  }

  const totalExpenses = [...categoryMap.values()].reduce((total, item) => total + Math.abs(item.expenseNet), 0);
  const categorySummary = [...categoryMap.values()].map((item) => ({
    ...item,
    expenseWeightPct: totalExpenses ? roundMoney((Math.abs(item.expenseNet) / totalExpenses) * 100) : 0
  }));
  const summaryByCategory = Object.fromEntries(categorySummary.map((item) => [item.category, item]));
  const konciliStyleSummary = {
    salesRevenue: roundMoney(
      Number(summaryByCategory.Venda?.finalAmount ?? 0) + Number(summaryByCategory["Frete e Logistica"]?.finalAmount ?? 0)
    ),
    expenses: roundMoney(
      Number(summaryByCategory.Comissao?.finalAmount ?? 0) +
        Number(summaryByCategory.Campanha?.finalAmount ?? 0) +
        Math.min(Number(summaryByCategory.Outros?.finalAmount ?? 0), 0)
    ),
    otherMovements: roundMoney(Math.max(Number(summaryByCategory.Outros?.finalAmount ?? 0), 0)),
    legacy: roundMoney(Number(summaryByCategory.Legado?.finalAmount ?? 0)),
    result: roundMoney(categorySummary.reduce((total, item) => total + item.finalAmount, 0))
  };

  return {
    detectedTemplate: "Repassify Auto Mapping",
    mapping,
    rawRows: parsed.rows,
    payouts,
    issuesByPayout,
    errors,
    stats: {
      fileName: input.fileName,
      sha256: parsed.sha256,
      detectedTemplate: "Repassify Auto Mapping",
      detectedFields: Object.keys(mapping),
      rawRows: parsed.rows.length,
      payoutRows: payouts.length,
      issueCount: [...issuesByPayout.values()].reduce((total, issues) => total + issues.length, 0),
      totals,
      categorySummary,
      launchSummary: [...launchMap.values()],
      statusSummary: [...statusMap.values()],
      konciliStyleSummary,
      reconciliationRows: launchRows,
      reconciliationRowsCount: launchRows.length
    }
  };
}

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
  orderNumber: ["pedido", "numero do pedido", "n pedido", "order", "order id", "order number", "id pedido"],
  payoutNumber: ["repasse", "payout", "lote", "settlement", "liquidacao", "numero repasse", "payout id"],
  channel: ["canal", "marketplace", "plataforma", "origem", "source"],
  company: ["empresa", "loja", "seller", "vendedor", "conta"],
  settlementDate: ["data repasse", "data de repasse", "data liquidacao", "settlement date", "paid date", "data pagamento"],
  periodStart: ["periodo inicio", "inicio periodo", "period start", "data inicial"],
  periodEnd: ["periodo fim", "fim periodo", "period end", "data final"],
  grossAmount: ["bruto", "valor bruto", "gross", "gross amount", "valor produto", "produto", "venda"],
  feeAmount: ["taxa", "taxas", "comissao", "comissao marketplace", "fee", "fees", "commission"],
  shippingAmount: ["frete", "shipping", "envio", "taxa frete", "shipping fee"],
  adsAmount: ["ads", "publicidade", "anuncios", "campanha", "marketing"],
  refundAmount: ["devolucao", "estorno", "refund", "reembolso", "chargeback"],
  retainedAmount: ["retido", "saldo retido", "reserva", "retained", "bloqueado"],
  expectedAmount: ["esperado", "valor esperado", "expected", "expected net", "liquido esperado"],
  receivedAmount: ["liquido", "valor liquido", "net", "net amount", "recebido", "valor recebido", "repasse liquido"]
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

function detectMapping(headers: string[]) {
  const normalizedHeaders = headers.map((header) => ({ header, normalized: normalizeText(header) }));
  const mapping: Record<string, string> = {};

  for (const [field, fieldAliases] of Object.entries(aliases)) {
    const normalizedAliases = fieldAliases.map(normalizeText);
    const exact = normalizedHeaders.find((item) => normalizedAliases.includes(item.normalized));
    const fuzzy =
      exact ??
      normalizedHeaders.find((item) =>
        normalizedAliases.some((alias) => item.normalized.includes(alias) || alias.includes(item.normalized))
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
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("A planilha nao possui abas para importacao.");
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
  const headerIndex = matrix.findIndex((row) => row.some((cell) => String(cell ?? "").trim()));

  if (headerIndex < 0) {
    throw new Error("A planilha esta vazia.");
  }

  const headers = matrix[headerIndex]!.map((cell, index) => String(cell || `Coluna ${index + 1}`).trim());
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

  for (const row of parsed.rows) {
    const channel = detectChannel(input.sourceName, input.fileName, getMapped(row, mapping, "channel"));
    const orderNumber = String(getMapped(row, mapping, "orderNumber") ?? "").trim();
    const rawPayoutNumber = String(getMapped(row, mapping, "payoutNumber") ?? "").trim();
    const payoutNumber = rawPayoutNumber || orderNumber || `IMP-${parsed.sha256.slice(0, 10)}-${row.rowNumber}`;
    const gross = Math.abs(parseMoney(getMapped(row, mapping, "grossAmount")));
    const fee = Math.abs(parseMoney(getMapped(row, mapping, "feeAmount")));
    const shipping = Math.abs(parseMoney(getMapped(row, mapping, "shippingAmount")));
    const ads = Math.abs(parseMoney(getMapped(row, mapping, "adsAmount")));
    const refund = Math.abs(parseMoney(getMapped(row, mapping, "refundAmount")));
    const retained = Math.abs(parseMoney(getMapped(row, mapping, "retainedAmount")));
    const explicitExpected = parseMoney(getMapped(row, mapping, "expectedAmount"));
    const explicitReceived = parseMoney(getMapped(row, mapping, "receivedAmount"));
    const expected = explicitExpected || (gross ? roundMoney(gross - fee - shipping - ads - refund) : explicitReceived);
    const received = explicitReceived || expected;
    const date = parseDate(getMapped(row, mapping, "settlementDate"), today);
    const periodStart = parseDate(getMapped(row, mapping, "periodStart"), date);
    const periodEnd = parseDate(getMapped(row, mapping, "periodEnd"), date);

    if (!gross && !received) {
      errors.push({ rowNumber: row.rowNumber, message: "Linha sem valor bruto ou liquido identificado." });
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
          ads: 0,
          refund: 0,
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

    grouped.set(payoutNumber, current);

    if (!mapping.feeAmount && gross) {
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
      totals
    }
  };
}

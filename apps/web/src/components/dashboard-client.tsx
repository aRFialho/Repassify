"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Eye,
  FileCheck2,
  FileText,
  Home,
  Info,
  LineChart,
  LogOut,
  MoreVertical,
  Percent,
  Search,
  SendHorizontal,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  TriangleAlert,
  Wallet,
  Workflow,
} from "lucide-react";
import {
  createAgentConversation,
  createCompany,
  createRule,
  exportErp,
  getCashflowReport,
  getChannelProviders,
  getChannels,
  getCompanies,
  getDashboardSummary,
  getDreReport,
  getImports,
  getIssues,
  getPayouts,
  getReconciledImportWorkbook,
  getRules,
  getTenant,
  getUsers,
  inviteUser,
  runReconciliation,
  sendAgentMessage,
  simulateRule,
  startChannelAuth,
  syncChannel,
  updateIssue,
  uploadImportFile,
  type ApiSession,
} from "@/lib/api";

const navItems = [
  { label: "Dashboard", icon: Home },
  { label: "Central de Repasses", icon: Settings },
  { label: "Conciliação", icon: FileCheck2 },
  { label: "Motor de Regras", icon: Workflow },
  { label: "Canais", icon: SlidersHorizontal },
  { label: "Empresas", icon: Building2 },
  { label: "Auditoria", icon: FileText },
  { label: "Relatórios", icon: FileText },
  { label: "Configurações", icon: Settings },
];

const channels = [
  {
    name: "Shopee",
    value: "R$ 3,64 mi",
    percent: 92,
    badge: "S",
    color: "#ff5a1f",
  },
  {
    name: "Mercado Livre",
    value: "R$ 2,98 mi",
    percent: 82,
    badge: "ML",
    color: "#f4d21f",
  },
  {
    name: "Amazon",
    value: "R$ 2,41 mi",
    percent: 68,
    badge: "a",
    color: "#111827",
  },
  {
    name: "Magalu",
    value: "R$ 1,89 mi",
    percent: 55,
    badge: "M",
    color: "#0096ff",
  },
  {
    name: "Shein",
    value: "R$ 1,56 mi",
    percent: 46,
    badge: "S",
    color: "#111111",
  },
];

interface DashboardClientProps {
  apiStatus: "checking" | "online" | "offline";
  session: ApiSession & {
    email: string;
    fullName: string;
    tenantName: string;
    role: string;
  };
  onLogout: () => void;
}

type AnyRecord = Record<string, unknown>;

interface WorkspaceState {
  payouts: AnyRecord[];
  imports: AnyRecord[];
  rules: AnyRecord[];
  companies: AnyRecord[];
  channels: AnyRecord[];
  issues: AnyRecord[];
  users: AnyRecord[];
  providers: AnyRecord[];
  summary: AnyRecord | null;
  dre: AnyRecord | null;
  cashflow: AnyRecord | null;
  tenant: AnyRecord | null;
}

const emptyWorkspace: WorkspaceState = {
  payouts: [],
  imports: [],
  rules: [],
  companies: [],
  channels: [],
  issues: [],
  users: [],
  providers: [],
  summary: null,
  dre: null,
  cashflow: null,
  tenant: null,
};

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function ChannelBadge({ name }: { name: string }) {
  const channel = channels.find((item) => item.name === name);
  return (
    <span
      className="channel-badge"
      style={{ "--badge-color": channel?.color ?? "#0a2d88" } as CSSProperties}
    >
      {channel?.badge ?? name.slice(0, 1)}
    </span>
  );
}

function getString(row: AnyRecord, key: string, fallback = "-") {
  const value = row[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function getMoney(row: AnyRecord, key: string) {
  const value = row[key];
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(number);
}

function asNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function formatMoneyValue(value: unknown) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(asNumber(value));
}

function getStats(row: AnyRecord) {
  return row.stats && typeof row.stats === "object" ? (row.stats as AnyRecord) : {};
}

function statsArray(row: AnyRecord, key: string): AnyRecord[] {
  const value = getStats(row)[key];
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === "object") as AnyRecord[]) : [];
}

function formatDate(value: unknown) {
  const raw = typeof value === "string" || typeof value === "number" ? String(value) : "";
  if (!raw) return "---";
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : raw;
}

function compactCode(row: AnyRecord) {
  const stats = getStats(row);
  const firstLaunch = Array.isArray(stats.reconciliationRows) ? (stats.reconciliationRows[0] as AnyRecord | undefined) : undefined;
  const conciliationId = firstLaunch ? getString(firstLaunch, "conciliationId", "") : "";
  return conciliationId || getString(row, "id", "").slice(0, 8).toUpperCase();
}

function importResult(row: AnyRecord) {
  const stats = getStats(row);
  const koncili = stats.konciliStyleSummary && typeof stats.konciliStyleSummary === "object" ? (stats.konciliStyleSummary as AnyRecord) : {};
  const totals = stats.totals && typeof stats.totals === "object" ? (stats.totals as AnyRecord) : {};
  return asNumber(koncili.result ?? totals.receivedAmount);
}

function importPeriod(row: AnyRecord) {
  const rows = statsArray(row, "reconciliationRows");
  const dates = rows.map((item) => getString(item, "settlementDate", "")).filter(Boolean).sort();
  if (dates.length) {
    return `${formatDate(dates[0])} - ${formatDate(dates[dates.length - 1])}`;
  }
  return formatDate(row.processedAt ?? row.createdAt);
}

function importStatusLabel(row: AnyRecord) {
  const status = getString(row, "status");
  if (status === "processed") return "Finalizada";
  if (status === "failed") return "Erro";
  if (status === "processing") return "Processando";
  return status;
}

function SimpleRows({ rows, columns }: { rows: AnyRecord[]; columns: Array<{ key: string; label: string }> }) {
  if (!rows.length) {
    return <div className="empty-state">Nenhum registro encontrado. Use as ações desta aba para criar dados.</div>;
  }

  return (
    <div className="module-table-wrap">
      <table className="module-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((row, index) => (
            <tr key={getString(row, "id", String(index))}>
              {columns.map((column) => (
                <td key={column.key}>{getString(row, column.key)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricStrip({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="module-metrics">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function WorkspaceModule({
  actionMessage,
  onCreateChannel,
  onCreateCompany,
  onCreateRule,
  onDownloadReconciledImport,
  onExportErp,
  onImportFile,
  onInviteUser,
  onResolveIssue,
  onRunReconciliation,
  onSimulateRule,
  onChannelAuth,
  onChannelSync,
  section,
  status,
  workspace,
}: {
  actionMessage: string;
  onCreateChannel: () => void;
  onCreateCompany: () => void;
  onCreateRule: () => void;
  onDownloadReconciledImport: (importId: string) => void;
  onExportErp: () => void;
  onImportFile: (file: File | null, channel?: AnyRecord) => void;
  onInviteUser: () => void;
  onResolveIssue: (issueId: string) => void;
  onRunReconciliation: () => void;
  onSimulateRule: (ruleId: string) => void;
  onChannelAuth: (provider: string) => void;
  onChannelSync: (provider: string) => void;
  section: string;
  status: "loading" | "ready" | "error";
  workspace: WorkspaceState;
}) {
  const [selectedReconciliationChannelId, setSelectedReconciliationChannelId] = useState<string | null>(null);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [reconciliationSearch, setReconciliationSearch] = useState("");
  const [reconciliationStatus, setReconciliationStatus] = useState("Todos");
  const panelStatus = status === "loading" ? "Sincronizando..." : actionMessage;

  if (section === "Central de Repasses") {
    return (
      <section className="panel module-panel">
        <PanelHeader title="Central de Repasses">
          <button className="primary-mini" onClick={onRunReconciliation} type="button">
            Reprocessar
          </button>
        </PanelHeader>
        <p className="module-note">{panelStatus}</p>
        <MetricStrip
          items={[
            { label: "Repasses carregados", value: String(workspace.payouts.length) },
            { label: "Divergências", value: String(workspace.issues.length) },
            { label: "Projetado", value: getMoney(workspace.cashflow ?? {}, "projected") },
          ]}
        />
        <SimpleRows
          rows={workspace.payouts}
          columns={[
            { key: "payoutNumber", label: "Repasse" },
            { key: "channel", label: "Canal" },
            { key: "company", label: "Empresa" },
            { key: "expectedAmount", label: "Esperado" },
            { key: "receivedAmount", label: "Recebido" },
            { key: "status", label: "Status" },
          ]}
        />
      </section>
    );
  }

  if (section === "Conciliação") {
    const latestProcessedImport = workspace.imports.find((row) => getString(row, "status") === "processed");
    const activeChannels = workspace.channels.filter((channel) => getString(channel, "status") === "active");
    const selectedChannel = activeChannels.find((channel) => getString(channel, "id") === selectedReconciliationChannelId) ?? null;
    const getChannelImports = (channel: AnyRecord) => {
      const channelId = getString(channel, "id");
      const provider = getString(channel, "provider");
      const displayName = getString(channel, "displayName", provider);
      return workspace.imports.filter((row) => {
        const rowChannelId = getString(row, "channelAccountId", "");
        const sourceName = getString(row, "sourceName", "").toLowerCase();
        return rowChannelId === channelId || sourceName.includes(provider.toLowerCase()) || sourceName.includes(displayName.toLowerCase());
      });
    };
    const selectedChannelImports = selectedChannel ? getChannelImports(selectedChannel) : [];
    const selectedImport = selectedChannelImports.find((row) => getString(row, "id") === selectedImportId) ?? null;
    const filteredConciliations = selectedChannelImports.filter((row) => {
      const haystack = [compactCode(row), getString(row, "sourceName"), importStatusLabel(row), importPeriod(row), String(importResult(row))]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !reconciliationSearch.trim() || haystack.includes(reconciliationSearch.trim().toLowerCase());
      const matchesStatus = reconciliationStatus === "Todos" || importStatusLabel(row) === reconciliationStatus;
      return matchesSearch && matchesStatus;
    });
    const importsByDay = filteredConciliations.reduce((groups, row) => {
      const key = formatDate(row.processedAt ?? row.createdAt);
      const current = groups.get(key) ?? [];
      current.push(row);
      groups.set(key, current);
      return groups;
    }, new Map<string, AnyRecord[]>());

    if (selectedImport && selectedChannel) {
      const summary = getStats(selectedImport).konciliStyleSummary as AnyRecord | undefined;
      const categories = statsArray(selectedImport, "categorySummary");
      const launches = statsArray(selectedImport, "launchSummary");
      const detailRows = statsArray(selectedImport, "reconciliationRows");

      return (
        <section className="panel module-panel reconciliation-workspace">
          <div className="reconciliation-topbar">
            <button className="ghost-action" onClick={() => setSelectedImportId(null)} type="button">
              <ArrowLeft size={17} />
              Voltar
            </button>
            <div>
              <strong>{getString(selectedChannel, "provider")} #{compactCode(selectedImport)}</strong>
              <span>{getString(selectedChannel, "displayName", getString(selectedChannel, "provider"))}</span>
            </div>
            <button className="primary-mini secondary" onClick={() => onDownloadReconciledImport(getString(selectedImport, "id"))} type="button">
              Baixar planilha
            </button>
          </div>

          <div className="koncili-summary-grid">
            <div><span>Receita de vendas</span><strong className="positive">{formatMoneyValue(summary?.salesRevenue)}</strong></div>
            <div><span>Despesas</span><strong className="negative">{formatMoneyValue(summary?.expenses)}</strong></div>
            <div><span>Outras movimentacoes</span><strong>{formatMoneyValue(summary?.otherMovements)}</strong></div>
            <div><span>Legado</span><strong className={asNumber(summary?.legacy) < 0 ? "negative" : "positive"}>{formatMoneyValue(summary?.legacy)}</strong></div>
            <div><span>Resultado</span><strong className="positive">{formatMoneyValue(summary?.result ?? importResult(selectedImport))}</strong></div>
          </div>

          <div className="reconciliation-detail-grid">
            <article className="reconciliation-detail-panel">
              <PanelHeader title="Resultado por Categoria" />
              <div className="module-table-wrap">
                <table className="module-table">
                  <thead>
                    <tr>
                      <th>Categoria</th>
                      <th>Receita liquida</th>
                      <th>Despesa liquida</th>
                      <th>Resultado final</th>
                      <th>Peso das despesas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((item) => (
                      <tr key={getString(item, "category")}>
                        <td>{getString(item, "category")}</td>
                        <td>{formatMoneyValue(item.revenueNet)}</td>
                        <td>{formatMoneyValue(item.expenseNet)}</td>
                        <td>{formatMoneyValue(item.finalAmount)}</td>
                        <td>{asNumber(item.expenseWeightPct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</td>
                      </tr>
                    ))}
                    {!categories.length ? <tr><td colSpan={5}>Sem categorias calculadas para esta conciliacao.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="reconciliation-detail-panel">
              <PanelHeader title="Lancamentos" />
              <div className="launch-chip-row">
                {launches.slice(0, 10).map((item) => (
                  <span key={getString(item, "launchName")}>{getString(item, "launchName")} <b>{getString(item, "count", "0")}</b></span>
                ))}
              </div>
              <div className="module-table-wrap">
                <table className="module-table">
                  <thead>
                    <tr>
                      <th>Pedido / Ref.</th>
                      <th>Data Repasse</th>
                      <th>Parcela</th>
                      <th>Lancamento</th>
                      <th>Valor previsto</th>
                      <th>Valor repasse</th>
                      <th>Diferenca</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.slice(0, 50).map((row, index) => (
                      <tr key={`${getString(row, "rowNumber", String(index))}-${index}`}>
                        <td>{getString(row, "orderNumber")}</td>
                        <td>{formatDate(row.settlementDate)}</td>
                        <td>{getString(row, "installment")}</td>
                        <td>{getString(row, "launchName")}</td>
                        <td>{formatMoneyValue(row.expectedAmount)}</td>
                        <td>{formatMoneyValue(row.receivedAmount)}</td>
                        <td>{formatMoneyValue(row.differenceAmount)}</td>
                        <td>{getString(row, "status")}</td>
                      </tr>
                    ))}
                    {!detailRows.length ? <tr><td colSpan={8}>Sem lancamentos detalhados para esta conciliacao.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </section>
      );
    }

    if (selectedChannel) {
      const provider = getString(selectedChannel, "provider");
      const displayName = getString(selectedChannel, "displayName", provider);

      return (
        <section className="panel module-panel reconciliation-workspace">
          <div className="reconciliation-topbar">
            <button
              className="ghost-action"
              onClick={() => {
                setSelectedReconciliationChannelId(null);
                setSelectedImportId(null);
              }}
              type="button"
            >
              <ArrowLeft size={17} />
              Canais
            </button>
            <div>
              <strong>{provider}</strong>
              <span>{displayName}</span>
            </div>
            <label className="file-action">
              Upload do canal
              <input accept=".csv,.tsv,.xlsx" onChange={(event) => onImportFile(event.target.files?.[0] ?? null, selectedChannel)} type="file" />
            </label>
          </div>

          <div className="conciliation-filter-panel">
            <div>
              <label>Numero da conciliacao</label>
              <input onChange={(event) => setReconciliationSearch(event.target.value)} placeholder="Ex: 927745" value={reconciliationSearch} />
            </div>
            <div>
              <label>Marketplace</label>
              <select disabled value={provider}><option>{provider}</option></select>
            </div>
            <div>
              <label>Conta</label>
              <select disabled value={displayName}><option>{displayName}</option></select>
            </div>
            <div>
              <label>Status de analise</label>
              <select onChange={(event) => setReconciliationStatus(event.target.value)} value={reconciliationStatus}>
                <option>Todos</option>
                <option>Finalizada</option>
                <option>Processando</option>
                <option>Erro</option>
              </select>
            </div>
          </div>

          <div className="conciliation-toolbar">
            <span>Exibindo {filteredConciliations.length} de {selectedChannelImports.length}</span>
            <button
              className="primary-mini secondary"
              onClick={() => {
                setReconciliationSearch("");
                setReconciliationStatus("Todos");
              }}
              type="button"
            >
              Limpar filtros
            </button>
          </div>

          {[...importsByDay.entries()].map(([day, rows]) => (
            <article className="conciliation-day-group" key={day}>
              <header>
                <strong>{day}</strong>
                <span>{rows.length} conciliacao{rows.length === 1 ? "" : "es"} · {formatMoneyValue(rows.reduce((total, row) => total + importResult(row), 0))}</span>
              </header>
              <div className="module-table-wrap">
                <table className="module-table conciliation-list-table">
                  <thead>
                    <tr>
                      <th>Codigo</th>
                      <th>Criada em</th>
                      <th>Finalizada em</th>
                      <th>Periodo de repasse</th>
                      <th>Marketplace</th>
                      <th>Conta</th>
                      <th>Total liquido</th>
                      <th>Status</th>
                      <th>Analisada?</th>
                      <th>Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={getString(row, "id")}>
                        <td>{compactCode(row)}</td>
                        <td>{formatDate(row.createdAt)}</td>
                        <td>{formatDate(row.processedAt)}</td>
                        <td>{importPeriod(row)}</td>
                        <td>{provider}</td>
                        <td>{displayName}</td>
                        <td>{formatMoneyValue(importResult(row))}</td>
                        <td><span className="status-pill success">{importStatusLabel(row)}</span></td>
                        <td><span className="status-pill">{statsArray(row, "reconciliationRows").length ? "Sim" : "Nao"}</span></td>
                        <td>
                          <button className="icon-table-action" onClick={() => setSelectedImportId(getString(row, "id"))} type="button"><Eye size={17} /></button>
                          <button className="icon-table-action" onClick={() => onDownloadReconciledImport(getString(row, "id"))} type="button"><FileText size={17} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}

          {!filteredConciliations.length ? (
            <div className="empty-state">Nenhuma conciliacao encontrada para este canal. Envie uma planilha para iniciar o historico.</div>
          ) : null}
        </section>
      );
    }

    return (
      <section className="panel module-panel">
        <PanelHeader title="Conciliação">
          <button className="primary-mini" onClick={onRunReconciliation} type="button">
            Rodar conciliação
          </button>
          {latestProcessedImport ? (
            <button
              className="primary-mini secondary"
              onClick={() => onDownloadReconciledImport(getString(latestProcessedImport, "id"))}
              type="button"
            >
              Baixar planilha conciliada
            </button>
          ) : null}
        </PanelHeader>
        <p className="module-note">{panelStatus}</p>
        <MetricStrip
          items={[
            { label: "Imports processados", value: String(workspace.imports.length) },
            { label: "Repasses identificados", value: String(workspace.payouts.length) },
            { label: "Divergências abertas", value: String(workspace.issues.length) },
          ]}
        />
        <div className="reconciliation-channel-grid">
          {activeChannels.map((channel) => {
            const channelId = getString(channel, "id");
            const provider = getString(channel, "provider");
            const displayName = getString(channel, "displayName", provider);
            const channelImports = workspace.imports.filter((row) => {
              const rowChannelId = getString(row, "channelAccountId", "");
              const sourceName = getString(row, "sourceName", "").toLowerCase();
              return rowChannelId === channelId || sourceName.includes(provider.toLowerCase()) || sourceName.includes(displayName.toLowerCase());
            });
            const lastImport = channelImports[0];
            const channelPayouts = workspace.payouts.filter((row) => getString(row, "channel") === provider);
            const channelIssueCount = channelImports.reduce((total, row) => {
              const stats = row.stats && typeof row.stats === "object" ? (row.stats as AnyRecord) : {};
              return total + Number(stats.issuesCreated ?? stats.issueCount ?? 0);
            }, 0);

            return (
              <article
                className="reconciliation-channel-card clickable"
                key={channelId}
                onClick={() => {
                  setSelectedReconciliationChannelId(channelId);
                  setSelectedImportId(null);
                }}
              >
                <div className="reconciliation-channel-head">
                  <ChannelBadge name={provider} />
                  <div>
                    <strong>{provider}</strong>
                    <span>{displayName}</span>
                  </div>
                  <em>Ativa</em>
                </div>
                <div className="reconciliation-card-metrics">
                  <div>
                    <span>Fila/histórico</span>
                    <strong>{channelImports.length}</strong>
                  </div>
                  <div>
                    <span>Repasses</span>
                    <strong>{channelPayouts.length}</strong>
                  </div>
                  <div>
                    <span>Divergências</span>
                    <strong>{channelIssueCount}</strong>
                  </div>
                </div>
                <div className="reconciliation-card-actions">
                  <label className="file-action" onClick={(event) => event.stopPropagation()}>
                    Upload do canal
                    <input
                      accept=".csv,.tsv,.xlsx"
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => onImportFile(event.target.files?.[0] ?? null, channel)}
                      type="file"
                    />
                  </label>
                  {lastImport ? (
                    <button
                      className="primary-mini secondary"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDownloadReconciledImport(getString(lastImport, "id"));
                      }}
                      type="button"
                    >
                      Baixar última
                    </button>
                  ) : null}
                </div>
                <div className="reconciliation-history">
                  {channelImports.length ? (
                    channelImports.slice(0, 4).map((row, index) => (
                      <button
                        key={getString(row, "id", String(index))}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedReconciliationChannelId(channelId);
                          setSelectedImportId(getString(row, "id"));
                        }}
                        type="button"
                      >
                        <span>{getString(row, "sourceName")}</span>
                        <small>
                          {getString(row, "status")} · {getString(row, "rowCount", "0")} linhas · {getString(row, "errorCount", "0")} alertas
                        </small>
                      </button>
                    ))
                  ) : (
                    <p>Nenhuma planilha conciliada para este canal.</p>
                  )}
                </div>
              </article>
            );
          })}
          {!activeChannels.length ? (
            <div className="empty-state">Nenhum canal ativo. Ative uma integração em Canais para conciliar planilhas por canal.</div>
          ) : null}
        </div>
      </section>
    );
  }

  if (section === "Motor de Regras") {
    return (
      <section className="panel module-panel">
        <PanelHeader title="Motor de Regras">
          <button className="primary-mini" onClick={onCreateRule} type="button">
            Criar regra
          </button>
        </PanelHeader>
        <p className="module-note">{panelStatus}</p>
        <div className="rules-list expanded">
          {workspace.rules.map((rule, index) => (
            <div className="rule-row" key={getString(rule, "id", String(index))}>
              <Workflow size={25} />
              <span>{getString(rule, "name")}</span>
              <b>→</b>
              <strong>{getString(rule, "module", "reconciliation")}</strong>
              <button onClick={() => onSimulateRule(getString(rule, "id"))} type="button">
                Simular
              </button>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (section === "Canais") {
    return (
      <section className="panel module-panel">
        <PanelHeader title="Canais">
          <button className="primary-mini" onClick={onCreateChannel} type="button">
            Conectar canal
          </button>
        </PanelHeader>
        <p className="module-note">{panelStatus}</p>
        <div className="channel-card-grid">
          {workspace.providers.map((providerRow, index) => {
            const provider = getString(providerRow, "provider");
            const connected = workspace.channels.find((channel) => getString(channel, "provider") === provider);
            return (
              <article className="channel-card" key={provider}>
                <div className="channel-logo" style={{ "--badge-color": channels[index]?.color ?? "#0a2d88" } as CSSProperties}>
                  {provider.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <strong>{provider}</strong>
                  <span>{connected ? getString(connected, "displayName") : "Integração inativa"}</span>
                </div>
                <em className={connected ? "active" : "inactive"}>{connected ? "Ativa" : "Inativa"}</em>
                <button onClick={() => onChannelAuth(provider)} type="button">Autenticar</button>
                <button onClick={() => onChannelSync(provider)} type="button">Sincronizar</button>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  if (section === "Empresas") {
    return (
      <section className="panel module-panel">
        <PanelHeader title="Empresas">
          <button className="primary-mini" onClick={onCreateCompany} type="button">
            Nova empresa
          </button>
        </PanelHeader>
        <p className="module-note">{panelStatus}</p>
        <SimpleRows
          rows={workspace.companies}
          columns={[
            { key: "legalName", label: "Razão social" },
            { key: "tradeName", label: "Nome fantasia" },
            { key: "cnpj", label: "CNPJ" },
            { key: "status", label: "Status" },
          ]}
        />
      </section>
    );
  }

  if (section === "Auditoria") {
    return (
      <section className="panel module-panel">
        <PanelHeader title="Auditoria" />
        <p className="module-note">{panelStatus}</p>
        <div className="audit-list">
          {workspace.issues.map((issue, index) => (
            <article key={getString(issue, "id", String(index))}>
              <strong>{getString(issue, "issueType")}</strong>
              <span>{getString(issue, "severity")} · {getMoney(issue, "amountImpact")}</span>
              <p>{getString(issue, "explanation")}</p>
              <button onClick={() => onResolveIssue(getString(issue, "id"))} type="button">
                Resolver
              </button>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (section === "Relatórios") {
    return (
      <section className="panel module-panel">
        <PanelHeader title="Relatórios">
          <button className="primary-mini" onClick={onExportErp} type="button">
            Exportar ERP
          </button>
        </PanelHeader>
        <p className="module-note">{panelStatus}</p>
        <MetricStrip
          items={[
            { label: "Receita", value: getMoney(workspace.dre ?? {}, "revenue") },
            { label: "Taxas", value: getMoney(workspace.dre ?? {}, "fees") },
            { label: "Margem", value: getMoney(workspace.dre ?? {}, "grossMargin") },
            { label: "Realizado", value: getMoney(workspace.cashflow ?? {}, "realized") },
          ]}
        />
      </section>
    );
  }

  return (
    <section className="panel module-panel">
      <PanelHeader title="Configurações">
        <button className="primary-mini" onClick={onInviteUser} type="button">
          Convidar usuário
        </button>
      </PanelHeader>
      <p className="module-note">{panelStatus}</p>
      <MetricStrip
        items={[
          { label: "Tenant", value: getString(workspace.tenant ?? {}, "legalName", "Repassify") },
          { label: "Usuários", value: String(workspace.users.length) },
          { label: "Canais", value: String(workspace.channels.length) },
        ]}
      />
      <SimpleRows
        rows={workspace.users}
        columns={[
          { key: "email", label: "E-mail" },
          { key: "fullName", label: "Nome" },
          { key: "role", label: "Perfil" },
          { key: "status", label: "Status" },
        ]}
      />
    </section>
  );
}

export function DashboardClient({
  apiStatus,
  session,
  onLogout,
}: DashboardClientProps) {
  const [activeSection, setActiveSection] = useState("Dashboard");
  const [query, setQuery] = useState("");
  const [workspace, setWorkspace] = useState<WorkspaceState>(emptyWorkspace);
  const [workspaceStatus, setWorkspaceStatus] = useState<"loading" | "ready" | "error">("loading");
  const [actionMessage, setActionMessage] = useState("Carregando dados operacionais...");
  const [chartView, setChartView] = useState<"Diario" | "Semanal" | "Mensal">("Diario");
  const [periodLabel, setPeriodLabel] = useState("Periodo atual");
  const [periodStart, setPeriodStart] = useState(() => getCurrentMonthRange().start);
  const [periodEnd, setPeriodEnd] = useState(() => getCurrentMonthRange().end);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantConversationId, setAssistantConversationId] = useState<string | null>(null);
  const [assistantAnswer, setAssistantAnswer] = useState(
    "Sou seu assistente virtual e estou aqui para explicar cada tela e ajudar nas suas analises.",
  );
  const [assistantStatus, setAssistantStatus] = useState<"idle" | "sending">("idle");
  const normalizedQuery = query.trim().toLowerCase();

  async function refreshWorkspace() {
    setWorkspaceStatus("loading");
    try {
      const load = async <T,>(label: string, promise: Promise<T>, fallback: T) => {
        try {
          return await promise;
        } catch (error) {
          console.error(`Falha ao carregar ${label}`, error);
          return fallback;
        }
      };

      const [
        summary,
        payoutRows,
        importRows,
        ruleRows,
        companyRows,
        channelRows,
        providerRows,
        issueRows,
        userRows,
        dre,
        cashflow,
        tenant,
      ] =
        await Promise.all([
          load("resumo", getDashboardSummary(session, { periodStart, periodEnd }), {}),
          load("repasses", getPayouts(session, { periodStart, periodEnd }), []),
          load("importacoes", getImports(session), []),
          load("regras", getRules(session), []),
          load("empresas", getCompanies(session), []),
          load("canais", getChannels(session), []),
          load("provedores", getChannelProviders(session), []),
          load("auditoria", getIssues(session), []),
          load("usuarios", getUsers(session), []),
          load("dre", getDreReport(session, { periodStart, periodEnd }), {}),
          load("fluxo de caixa", getCashflowReport(session, { periodStart, periodEnd }), {}),
          load("tenant", getTenant(session), null),
        ]);

      setWorkspace({
        payouts: payoutRows as AnyRecord[],
        imports: importRows as AnyRecord[],
        rules: ruleRows as AnyRecord[],
        companies: companyRows as AnyRecord[],
        channels: channelRows as AnyRecord[],
        providers: providerRows as AnyRecord[],
        issues: issueRows as AnyRecord[],
        users: userRows as AnyRecord[],
        summary,
        dre,
        cashflow,
        tenant,
      });
      setWorkspaceStatus("ready");
      setActionMessage("Dados sincronizados com a API.");
    } catch (error) {
      setWorkspaceStatus("error");
      setActionMessage(error instanceof Error ? error.message : "Falha ao carregar dados operacionais.");
    }
  }

  useEffect(() => {
    void refreshWorkspace();
  }, [session.accessToken, session.tenantId]);

  async function runAction(label: string, action: () => Promise<unknown>, shouldRefresh = true) {
    setActionMessage(`${label}...`);
    try {
      const result = await action();
      setActionMessage(`${label} concluido.`);
      if (shouldRefresh) {
        await refreshWorkspace();
      }
      return result;
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : `Falha em: ${label}`);
      return null;
    }
  }

  async function handleDownloadReconciledImport(importId: string) {
    if (!importId || importId === "-") {
      setActionMessage("Selecione uma importacao processada para baixar a planilha conciliada.");
      return;
    }

    const workbook = (await runAction(
      "Gerando planilha conciliada",
      () => getReconciledImportWorkbook(session, importId),
      false,
    )) as { blob: Blob; fileName: string } | null;

    if (!workbook) {
      return;
    }

    const url = window.URL.createObjectURL(workbook.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = workbook.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setActionMessage(`Planilha conciliada gerada: ${workbook.fileName}.`);
  }

  async function handleImportFile(file: File | null, channel?: AnyRecord) {
    if (!file) return;

    const provider = channel ? getString(channel, "provider") : "";
    const displayName = channel ? getString(channel, "displayName", provider) : file.name;
    const imported = (await runAction(
      provider ? `Planilha ${provider} conciliada` : "Planilha conciliada",
      () =>
        uploadImportFile(session, file, {
          channelAccountId: channel ? getString(channel, "id") : undefined,
          sourceName: displayName,
        }),
      false,
    )) as
      | AnyRecord
      | null;

    if (imported?.id) {
      await refreshWorkspace();
      await handleDownloadReconciledImport(String(imported.id));
      setActionMessage(
        `Planilha processada: ${getString(imported, "rowCount", "0")} linhas, ${getString(
          imported,
          "errorCount",
          "0",
        )} alertas de leitura.`,
      );
    }
  }

  async function handleCreateCompany() {
    const legalName = window.prompt("Razao social da empresa:");
    if (!legalName?.trim()) {
      setActionMessage("Cadastro de empresa cancelado.");
      return;
    }

    const tradeName = window.prompt("Nome fantasia:", legalName) ?? legalName;
    const cnpj = window.prompt("CNPJ, somente numeros:")?.replace(/\D/g, "");

    if (!cnpj || cnpj.length !== 14) {
      setActionMessage("Informe um CNPJ real com 14 digitos para cadastrar a empresa.");
      return;
    }

    await runAction("Empresa criada", () =>
      createCompany(session, {
        legalName: legalName.trim(),
        tradeName: tradeName.trim(),
        cnpj,
        taxRegime: "simples_nacional",
        financeOwnerName: session.fullName,
        financeOwnerEmail: session.email,
      }),
    );
  }

  async function handleCreateChannel() {
    goToSection("Canais", "Escolha um canal e clique em Autenticar. Nenhuma conta e criada sem credenciais reais.");
  }

  async function handleChannelAuth(provider: string) {
    const result = (await runAction(`Autenticacao ${provider}`, () => startChannelAuth(session, provider), false)) as
      | AnyRecord
      | null;
    const authorizationUrl = typeof result?.authorizationUrl === "string" ? result.authorizationUrl : "";

    if (authorizationUrl) {
      window.location.assign(authorizationUrl);
      return;
    }

    setActionMessage(getString(result ?? {}, "message", "Credenciais do canal ainda nao configuradas."));
  }

  async function handleChannelSync(provider: string) {
    await runAction(`Sincronizacao ${provider}`, () => syncChannel(session, provider), false);
  }

  async function handleCreateRule() {
    const name = window.prompt("Nome da regra:");
    if (!name?.trim()) {
      setActionMessage("Criacao de regra cancelada.");
      return;
    }

    const channel = window.prompt("Canal da regra (opcional):")?.trim();
    await runAction("Regra criada", () =>
      createRule(session, {
        name: name.trim(),
        module: "reconciliation",
        priority: 90,
        scope: channel ? { channel } : {},
        definition: {
          conditions: { all: [{ field: "shippingAmount", operator: "gt", value: 50 }] },
          actions: [{ type: "mark_audit", severity: "medium" }],
        },
      }),
    );
  }

  async function handleInviteUser() {
    const email = window.prompt("E-mail do usuario:");
    if (!email?.trim()) {
      setActionMessage("Convite cancelado.");
      return;
    }

    await runAction("Convite enviado", () =>
      inviteUser(session, {
        email: email.trim(),
        role: "finance_manager",
      }),
    );
  }

  function goToSection(section: string, message: string) {
    setActiveSection(section);
    setNotificationsOpen(false);
    setPeriodOpen(false);
    setActionMessage(message);
  }

  function formatDateLabel(value: string) {
    const [year, month, day] = value.split("-");
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  function applyPeriodFilter() {
    if (!periodStart || !periodEnd) {
      setActionMessage("Selecione data inicial e final para aplicar o periodo.");
      return;
    }

    if (periodStart > periodEnd) {
      setActionMessage("A data inicial nao pode ser maior que a data final.");
      return;
    }

    setPeriodLabel(`${formatDateLabel(periodStart)} - ${formatDateLabel(periodEnd)}`);
    setPeriodOpen(false);
    setActionMessage("Periodo aplicado ao dashboard. Os proximos filtros da API usarao este intervalo.");
    void refreshWorkspace();
  }

  function resetPeriodFilter() {
    const range = getCurrentMonthRange();
    setPeriodLabel("Periodo atual");
    setPeriodStart(range.start);
    setPeriodEnd(range.end);
    setPeriodOpen(false);
    setActionMessage("Periodo atual restaurado.");
    void refreshWorkspace();
  }

  function buildAssistantContext() {
    return {
      section: activeSection,
      period: periodLabel,
      counts: {
        payouts: workspace.payouts.length,
        imports: workspace.imports.length,
        rules: workspace.rules.length,
        channels: workspace.channels.length,
        providers: workspace.providers.length,
        issues: workspace.issues.length,
        users: workspace.users.length,
      },
      summary: workspace.summary ?? {},
      dre: workspace.dre ?? {},
      cashflow: workspace.cashflow ?? {},
      topIssues: workspace.issues.slice(0, 3).map((issue) => ({
        issueType: getString(issue, "issueType"),
        severity: getString(issue, "severity"),
        amountImpact: issue.amountImpact ?? 0,
        explanation: getString(issue, "explanation"),
      })),
    };
  }

  async function getAssistantConversationId() {
    if (assistantConversationId) {
      return assistantConversationId;
    }

    const conversation = await createAgentConversation(session, {
      functionId: `workspace.${activeSection.toLowerCase().replace(/\s+/g, "_")}`,
      title: `Assistente - ${activeSection}`,
    });
    const conversationId = getString(conversation, "id", "");

    if (!conversationId) {
      throw new Error("Nao foi possivel iniciar a conversa do assistente.");
    }

    setAssistantConversationId(conversationId);
    return conversationId;
  }

  async function askAssistant(question: string) {
    const prompt = question.trim();

    if (!prompt) {
      setActionMessage("Digite uma pergunta para o assistente.");
      return;
    }

    setAssistantPrompt(prompt);
    setAssistantStatus("sending");
    setActionMessage("Assistente analisando sua pergunta...");

    try {
      const conversationId = await getAssistantConversationId();
      const result = await sendAgentMessage(session, conversationId, prompt, buildAssistantContext());
      const answer = getString(
        result,
        "assistantMessage",
        "Nao recebi uma resposta do assistente. Tente novamente em instantes.",
      );

      setAssistantAnswer(answer);
      setActionMessage("Assistente respondeu.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Assistente indisponivel no momento.";
      setAssistantAnswer(message);
      setActionMessage(message);
    } finally {
      setAssistantStatus("idle");
    }
  }

  function handleAssistantQuestion(question: string) {
    void askAssistant(question);
  }

  function handleAssistantSend() {
    void askAssistant(assistantPrompt);
  }

  const filteredPayouts = useMemo(
    () =>
      normalizedQuery
        ? workspace.payouts.filter((row) =>
            Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery)),
          )
        : workspace.payouts,
    [normalizedQuery, workspace.payouts],
  );

  const filteredChannels = useMemo(
    () =>
      normalizedQuery
        ? workspace.channels.filter((channel) =>
            getString(channel, "provider").toLowerCase().includes(normalizedQuery),
          )
        : workspace.channels,
    [normalizedQuery, workspace.channels],
  );

  const userName = session.fullName || session.email.split("@")[0] || "Admin";
  const initials = userName.slice(0, 2).toUpperCase();
  const summary = workspace.summary ?? {};
  const dashboardKpis = [
    {
      label: "Total conciliado",
      value: getMoney(summary, "receivedAmount"),
      delta: `${workspace.payouts.length} repasses`,
      trend: "up",
      icon: LineChart,
      tone: "mint",
    },
    {
      label: "Repasse previsto",
      value: getMoney(summary, "expectedNetAmount"),
      delta: `${workspace.imports.length} imports`,
      trend: "up",
      icon: CalendarDays,
      tone: "blue",
    },
    {
      label: "Divergências",
      value: getMoney(summary, "differenceAmount"),
      delta: `${workspace.issues.length} pendencias`,
      trend: Number(summary.differenceAmount ?? 0) < 0 ? "down" : "up",
      icon: TriangleAlert,
      tone: "red",
    },
    {
      label: "Margem real",
      value: `${Number(summary.marginPercent ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
      delta: "base real",
      trend: "up",
      icon: Percent,
      tone: "mint",
    },
    {
      label: "Taxa média",
      value:
        Number(summary.grossAmount ?? 0) > 0
          ? `${((Number(summary.feeAmount ?? 0) / Number(summary.grossAmount ?? 1)) * 100).toLocaleString("pt-BR", {
              maximumFractionDigits: 1,
            })}%`
          : "0%",
      delta: "sem fallback",
      trend: "up",
      icon: Tag,
      tone: "blue",
    },
    {
      label: "Saldo a liberar",
      value: getMoney(summary, "retainedAmount"),
      delta: `${Number(summary.criticalIssues ?? 0)} criticos`,
      trend: "up",
      icon: Wallet,
      tone: "teal",
    },
  ];

  return (
    <main className="replica-shell">
      <aside className="replica-sidebar">
        <div className="replica-brand">
          <img src="/imgs/icon-light.png" alt="" />
          <strong>Repassify</strong>
        </div>

        <nav className="replica-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className={activeSection === item.label ? "active" : ""}
                onClick={() => setActiveSection(item.label)}
                type="button"
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="secure-card">
          <div className="secure-icon">
            <ShieldCheck size={42} />
          </div>
          <strong>Seu ambiente está seguro</strong>
          <p>Dados criptografados e auditoria ativa</p>
          <button
            onClick={() =>
              goToSection("Configurações", "Abra configuracoes para revisar usuarios, permissoes e canais ativos.")
            }
            type="button"
          >
            Saiba mais <span>→</span>
          </button>
        </div>
      </aside>

      <section className="replica-main">
        <header className="replica-header">
          <label className="replica-search">
            <Search size={24} />
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por canais, empresas, pedidos..."
              value={query}
            />
            <kbd>⌘K</kbd>
          </label>

          <div className="header-actions">
            <span className={`top-api-status ${apiStatus}`}>
              <i />
              API{" "}
              {apiStatus === "online"
                ? "online"
                : apiStatus === "checking"
                  ? "verificando"
                  : "offline"}
            </span>
            <div className="header-popover-wrap">
              <button
                aria-expanded={periodOpen}
                className="date-filter"
                onClick={() => {
                  setPeriodOpen((open) => !open);
                  setNotificationsOpen(false);
                }}
                type="button"
              >
                <CalendarDays size={18} />
                {periodLabel}
                <ChevronDown size={18} />
              </button>
              {periodOpen ? (
                <div className="header-popover period-popover">
                  <label>
                    <span>Inicio</span>
                    <input onChange={(event) => setPeriodStart(event.target.value)} type="date" value={periodStart} />
                  </label>
                  <label>
                    <span>Fim</span>
                    <input onChange={(event) => setPeriodEnd(event.target.value)} type="date" value={periodEnd} />
                  </label>
                  <div className="popover-actions">
                    <button onClick={resetPeriodFilter} type="button">Limpar</button>
                    <button onClick={applyPeriodFilter} type="button">Aplicar</button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="header-popover-wrap">
              <button
                aria-expanded={notificationsOpen}
                className="header-icon notification"
                onClick={() => {
                  setNotificationsOpen((open) => !open);
                  setPeriodOpen(false);
                }}
                type="button"
              >
                <Bell size={25} />
                <span>{workspace.issues.length}</span>
              </button>
              {notificationsOpen ? (
                <div className="header-popover notification-popover">
                  <strong>Notificacoes</strong>
                  {workspace.issues.length ? (
                    workspace.issues.slice(0, 5).map((issue, index) => (
                      <button
                        key={getString(issue, "id", String(index))}
                        onClick={() => goToSection("Auditoria", `Abrindo ${getString(issue, "issueType")}.`)}
                        type="button"
                      >
                        <span>{getString(issue, "issueType")}</span>
                        <small>{getString(issue, "severity")} · {getMoney(issue, "amountImpact")}</small>
                      </button>
                    ))
                  ) : (
                    <p>Nenhuma divergencia aberta.</p>
                  )}
                </div>
              ) : null}
            </div>
            <button
              className="header-icon"
              onClick={() =>
                setActionMessage(
                  "Ajuda: use Canais para autenticar, Conciliacao para importar e Auditoria para tratar divergencias.",
                )
              }
              type="button"
            >
              <CircleHelp size={24} />
            </button>
            <button className="profile-button" onClick={onLogout} type="button">
              <span className="avatar-face">{initials}</span>
              <span>
                <strong>{userName}</strong>
                <small>Admin</small>
              </span>
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {activeSection !== "Dashboard" ? (
          <WorkspaceModule
            actionMessage={actionMessage}
            onCreateChannel={handleCreateChannel}
            onCreateCompany={handleCreateCompany}
            onCreateRule={handleCreateRule}
            onChannelAuth={handleChannelAuth}
            onChannelSync={handleChannelSync}
            onDownloadReconciledImport={(importId) => void handleDownloadReconciledImport(importId)}
            onExportErp={() => runAction("Exportacao ERP", () => exportErp(session), false)}
            onImportFile={handleImportFile}
            onInviteUser={handleInviteUser}
            onResolveIssue={(issueId) =>
              runAction("Divergencia atualizada", () => updateIssue(session, issueId, "resolved"))
            }
            onRunReconciliation={() =>
              runAction("Conciliacao iniciada", () => runReconciliation(session), false)
            }
            onSimulateRule={(ruleId) =>
              runAction("Simulacao de regra", () => simulateRule(session, ruleId), false)
            }
            section={activeSection}
            status={workspaceStatus}
            workspace={workspace}
          />
        ) : (
          <>
            <section className="kpi-grid">
              {dashboardKpis.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.label} className="kpi-card">
                    <div className={`kpi-icon ${item.tone}`}>
                      <Icon size={31} />
                    </div>
                    <div className="kpi-content">
                      <span>
                        {item.label}
                        <Info size={14} />
                      </span>
                      <strong>{item.value}</strong>
                      <small className={item.trend}>
                        {item.trend === "up" ? "↑" : "↓"} {item.delta}
                      </small>
                    </div>
                  </article>
                );
              })}
            </section>

            <section className="dashboard-grid">
              <article className="panel chart-panel">
                <PanelHeader title="Evolução dos repasses">
                  <div className="segmented-tabs">
                    {(["Diario", "Semanal", "Mensal"] as const).map((view) => (
                      <button
                        className={chartView === view ? "active" : ""}
                        key={view}
                        onClick={() => {
                          setChartView(view);
                          setActionMessage(`Visualizacao ${view.toLowerCase()} aplicada aos repasses reais.`);
                        }}
                        type="button"
                      >
                        {view}
                      </button>
                    ))}
                  </div>
                  <MoreVertical size={22} />
                </PanelHeader>
                {workspace.payouts.length ? (
                  <SimpleRows
                    rows={workspace.payouts}
                    columns={[
                      { key: "period", label: "Periodo" },
                      { key: "channel", label: "Canal" },
                      { key: "expectedAmount", label: "Esperado" },
                      { key: "receivedAmount", label: "Recebido" },
                      { key: "differenceAmount", label: "Diferença" },
                    ]}
                  />
                ) : (
                  <div className="empty-state">Importe planilhas ou sincronize canais para gerar a evolução.</div>
                )}
              </article>

              <article className="panel performance-panel">
                <PanelHeader title="Performance por canal">
                  <button
                    className="select-button"
                    onClick={() => setActionMessage("Performance calculada pelos canais conectados reais.")}
                    type="button"
                  >
                    Valor conciliado <ChevronDown size={16} />
                  </button>
                </PanelHeader>
                <div className="performance-list">
                  {filteredChannels.map((channel) => (
                    <div key={getString(channel, "id")} className="performance-row">
                      <ChannelBadge name={getString(channel, "provider")} />
                      <strong>{getString(channel, "provider")}</strong>
                      <span className="bar">
                        <i style={{ width: getString(channel, "status") === "active" ? "100%" : "30%" }} />
                      </span>
                      <em>{getString(channel, "status")}</em>
                    </div>
                  ))}
                  {!filteredChannels.length ? <div className="empty-state">Nenhum canal conectado.</div> : null}
                </div>
              </article>

              <article className="panel mix-panel">
                <PanelHeader title="Mix por canal" />
                {workspace.payouts.length ? <div className="mix-content">
                  <div className="donut">
                    <div>
                      <strong>{getMoney(summary, "receivedAmount")}</strong>
                      <span>Total</span>
                    </div>
                  </div>
                  <div className="mix-list">
                    {workspace.channels.slice(0, 5).map((item, index) => (
                      <div key={getString(item, "id", String(index))}>
                        <span style={{ background: channels[index]?.color ?? "#0a2d88" }} />
                        <p>{getString(item, "provider")}</p>
                        <strong>{getString(item, "status")}</strong>
                      </div>
                    ))}
                  </div>
                </div> : <div className="empty-state">Sem repasses reais para calcular mix.</div>}
              </article>

              <article className="panel payouts-panel">
                <PanelHeader title="Repasses recentes" />
                <table className="payout-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Canal</th>
                      <th>Empresa</th>
                      <th>Pedido</th>
                      <th>Valor do repasse</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayouts.map((row) => (
                      <tr key={getString(row, "id")}>
                        <td>{getString(row, "period")}</td>
                        <td>
                          <ChannelBadge name={getString(row, "channel")} /> {getString(row, "channel")}
                        </td>
                        <td>{getString(row, "company")}</td>
                        <td>{getString(row, "payoutNumber")}</td>
                        <td>{getMoney(row, "receivedAmount")}</td>
                        <td>
                          <span className={`status ${getString(row, "status")}`}>{getString(row, "status")}</span>
                        </td>
                        <td>
                          <button
                            className="eye-button"
                            onClick={() =>
                              goToSection("Central de Repasses", `Abrindo repasse ${getString(row, "payoutNumber")}.`)
                            }
                            type="button"
                          >
                            <Eye size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filteredPayouts.length ? <div className="empty-state">Nenhum repasse real importado ou sincronizado.</div> : null}
                <button
                  className="view-all"
                  onClick={() => goToSection("Central de Repasses", "Listando todos os repasses reais.")}
                  type="button"
                >
                  Ver todos os repasses <span>→</span>
                </button>
              </article>

              <article className="panel rules-panel">
                <PanelHeader title="Motor de Regras">
                  <button
                    className="link-button"
                    onClick={() => goToSection("Motor de Regras", "Abrindo todas as regras cadastradas.")}
                    type="button"
                  >
                    Ver todas
                  </button>
                </PanelHeader>
                <div className="rules-list">
                  {workspace.rules.slice(0, 3).map((rule, index) => (
                    <div key={getString(rule, "id", String(index))} className="rule-row">
                      <Workflow size={25} />
                      <span>{getString(rule, "name")}</span>
                      <b>→</b>
                      <strong>{getString(rule, "module")}</strong>
                      <em>{getString(rule, "status")}</em>
                    </div>
                  ))}
                  {!workspace.rules.length ? <div className="empty-state">Nenhuma regra cadastrada.</div> : null}
                </div>
                <button className="new-rule" onClick={handleCreateRule} type="button">+ Nova regra</button>
              </article>

              <article className="assistant-card">
                <div className="assistant-head">
                  <div>
                    <strong>Assistente Repassify</strong>
                    <span>IA</span>
                  </div>
                  <Sparkles size={24} />
                </div>
                <div className="assistant-body">
                  <div className="bot-avatar">
                    <Bot size={39} />
                  </div>
                  <div>
                    <strong>Olá, {userName}!</strong>
                    <p>{assistantStatus === "sending" ? "Analisando sua pergunta..." : assistantAnswer}</p>
                  </div>
                </div>
                <div className="assistant-questions">
                  <button
                    disabled={assistantStatus === "sending"}
                    onClick={() => handleAssistantQuestion("O que significa divergencia?")}
                    type="button"
                  >
                    O que significa divergência? <span>→</span>
                  </button>
                  <button
                    disabled={assistantStatus === "sending"}
                    onClick={() => handleAssistantQuestion("Como funciona a conciliacao?")}
                    type="button"
                  >
                    Como funciona a conciliação? <span>→</span>
                  </button>
                  <button
                    disabled={assistantStatus === "sending"}
                    onClick={() => handleAssistantQuestion("Quais canais tem mais divergencias?")}
                    type="button"
                  >
                    Quais canais têm mais divergências? <span>→</span>
                  </button>
                </div>
                <label className="assistant-input">
                  <input
                    disabled={assistantStatus === "sending"}
                    onChange={(event) => setAssistantPrompt(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAssistantSend();
                      }
                    }}
                    placeholder="Pergunte algo..."
                    value={assistantPrompt}
                  />
                  <button disabled={assistantStatus === "sending"} onClick={handleAssistantSend} type="button">
                    <SendHorizontal size={25} />
                  </button>
                </label>
              </article>
            </section>
          </>
        )}

        <footer className="replica-footer">
          <span>
            © 2026 Davantti Commerce Suite Todos os direitos reservados.
          </span>
          <div>
            <a>Política de Privacidade</a>
            <a>Termos de Uso</a>
            <a>Segurança</a>
          </div>
        </footer>
      </section>
    </main>
  );
}

function PanelHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel-header">
      <h2>
        {title} <Info size={16} />
      </h2>
      {children ? <div className="panel-actions">{children}</div> : null}
    </div>
  );
}

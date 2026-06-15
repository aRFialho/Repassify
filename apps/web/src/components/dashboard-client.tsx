"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
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
  confirmImport,
  createChannel,
  createCompany,
  createImport,
  createRule,
  exportErp,
  getCashflowReport,
  getChannels,
  getCompanies,
  getDreReport,
  getImports,
  getIssues,
  getPayouts,
  getRules,
  getTenant,
  getUsers,
  inviteUser,
  previewImport,
  runReconciliation,
  simulateRule,
  updateIssue,
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

const kpis = [
  {
    label: "Total conciliado",
    value: "R$ 12,48 mi",
    delta: "18,6% vs abr/24",
    trend: "up",
    icon: LineChart,
    tone: "mint",
  },
  {
    label: "Repasse previsto",
    value: "R$ 14,75 mi",
    delta: "15,2% vs abr/24",
    trend: "up",
    icon: CalendarDays,
    tone: "blue",
  },
  {
    label: "Divergências",
    value: "R$ 386,7 mil",
    delta: "7,1% vs abr/24",
    trend: "down",
    icon: TriangleAlert,
    tone: "red",
  },
  {
    label: "Margem real",
    value: "22,8%",
    delta: "2,3 p.p. vs abr/24",
    trend: "up",
    icon: Percent,
    tone: "mint",
  },
  {
    label: "Taxa média",
    value: "15,42%",
    delta: "0,8 p.p. vs abr/24",
    trend: "down",
    icon: Tag,
    tone: "blue",
  },
  {
    label: "Saldo a liberar",
    value: "R$ 2,14 mi",
    delta: "11,4% vs abr/24",
    trend: "up",
    icon: Wallet,
    tone: "teal",
  },
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

const mix = [
  { name: "Shopee", value: "29,2%", color: "#0a2d88" },
  { name: "Mercado Livre", value: "23,9%", color: "#17d0b0" },
  { name: "Amazon", value: "19,3%", color: "#0c7d82" },
  { name: "Magalu", value: "15,1%", color: "#635bff" },
  { name: "Shein", value: "12,5%", color: "#ff9d1c" },
];

const recentPayouts = [
  [
    "31/05/2024",
    "Shopee",
    "Bella Store Ltda.",
    "#SHO-78291",
    "R$ 128.950,45",
    "Conciliado",
    "ok",
  ],
  [
    "31/05/2024",
    "Mercado Livre",
    "Tech House Comercio",
    "#MEL-99321",
    "R$ 97.430,10",
    "Conciliado",
    "ok",
  ],
  [
    "31/05/2024",
    "Amazon",
    "Prime Imports S.A.",
    "#AMZ-11293",
    "R$ 85.720,90",
    "Em auditoria",
    "audit",
  ],
  [
    "30/05/2024",
    "Magalu",
    "Magalu Marketplace",
    "#MAG-33211",
    "R$ 63.221,30",
    "Conciliado",
    "ok",
  ],
  [
    "30/05/2024",
    "Shein",
    "Shein Brasil",
    "#SHE-87122",
    "R$ 52.340,60",
    "Pendente",
    "pending",
  ],
];

const rules = [
  ["Se canal = Shopee", "Taxa = 20%", "Ativa"],
  ["Se frete > 50", "Marcar auditoria", "Ativa"],
  ["Se divergência > 5%", "Notificar time", "Ativa"],
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
  dre: null,
  cashflow: null,
  tenant: null,
};

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

function makeValidCnpj(seed: number) {
  const base = String(100000000000 + (seed % 899999999999)).padStart(12, "0").slice(0, 12);
  const digits = base.split("").map(Number);
  const calc = (values: number[], weights: number[]) => {
    const sum = weights.reduce((total, weight, index) => total + weight * (values[index] ?? 0), 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const first = calc(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calc([...digits, first], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${first}${second}`;
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
  onExportErp,
  onImportFile,
  onInviteUser,
  onResolveIssue,
  onRunReconciliation,
  onSimulateRule,
  section,
  status,
  workspace,
}: {
  actionMessage: string;
  onCreateChannel: () => void;
  onCreateCompany: () => void;
  onCreateRule: () => void;
  onExportErp: () => void;
  onImportFile: (file: File | null) => void;
  onInviteUser: () => void;
  onResolveIssue: (issueId: string) => void;
  onRunReconciliation: () => void;
  onSimulateRule: (ruleId: string) => void;
  section: string;
  status: "loading" | "ready" | "error";
  workspace: WorkspaceState;
}) {
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
    return (
      <section className="panel module-panel">
        <PanelHeader title="Conciliação">
          <label className="file-action">
            Upload planilha
            <input
              accept=".csv,.xlsx,.xls"
              onChange={(event) => onImportFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
          <button className="primary-mini" onClick={onRunReconciliation} type="button">
            Rodar conciliação
          </button>
        </PanelHeader>
        <p className="module-note">{panelStatus}</p>
        <SimpleRows
          rows={workspace.imports}
          columns={[
            { key: "sourceName", label: "Origem" },
            { key: "sourceType", label: "Tipo" },
            { key: "fileHash", label: "Arquivo" },
            { key: "status", label: "Status" },
          ]}
        />
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
        <SimpleRows
          rows={workspace.channels}
          columns={[
            { key: "provider", label: "Canal" },
            { key: "displayName", label: "Conta" },
            { key: "externalAccountId", label: "ID externo" },
            { key: "status", label: "Status" },
          ]}
        />
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
  const normalizedQuery = query.trim().toLowerCase();

  async function refreshWorkspace() {
    setWorkspaceStatus("loading");
    try {
      const [payoutRows, importRows, ruleRows, companyRows, channelRows, issueRows, userRows, dre, cashflow, tenant] =
        await Promise.all([
          getPayouts(session),
          getImports(session),
          getRules(session),
          getCompanies(session),
          getChannels(session),
          getIssues(session),
          getUsers(session),
          getDreReport(session),
          getCashflowReport(session),
          getTenant(session),
        ]);

      setWorkspace({
        payouts: payoutRows as AnyRecord[],
        imports: importRows as AnyRecord[],
        rules: ruleRows as AnyRecord[],
        companies: companyRows as AnyRecord[],
        channels: channelRows as AnyRecord[],
        issues: issueRows as AnyRecord[],
        users: userRows as AnyRecord[],
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

  async function handleImportFile(file: File | null) {
    if (!file) return;

    const created = (await runAction(
      "Upload registrado",
      () =>
        createImport(session, {
          sourceType: "settlements",
          sourceName: file.name.includes("Shopee") ? "Shopee" : "Planilha de conciliacao",
          fileName: file.name,
          sizeBytes: file.size,
        }),
      false,
    )) as AnyRecord | null;

    if (created?.id) {
      await previewImport(session, String(created.id));
      await confirmImport(session, String(created.id), {
        order_number: "Pedido",
        gross_amount: "Valor bruto",
        fee_amount: "Taxas",
        net_amount: "Liquido",
      });
      await refreshWorkspace();
      setActionMessage("Planilha mapeada e fila de conciliacao criada.");
    }
  }

  async function handleCreateCompany() {
    const suffix = String(Date.now()).slice(-6);
    await runAction("Empresa criada", () =>
      createCompany(session, {
        legalName: `Empresa Repassify ${suffix} Ltda.`,
        tradeName: `Loja ${suffix}`,
        cnpj: makeValidCnpj(Date.now()),
        taxRegime: "simples_nacional",
        financeOwnerName: session.fullName,
        financeOwnerEmail: session.email,
      }),
    );
  }

  async function handleCreateChannel() {
    const providers = ["Shopee", "Mercado Livre", "Amazon", "Magalu"] as const;
    const provider = providers[workspace.channels.length % providers.length] ?? "Shopee";
    await runAction("Canal conectado", () =>
      createChannel(session, {
        provider,
        displayName: `${provider} - Conta principal`,
        externalAccountId: `${provider.toLowerCase().replace(/\s/g, "-")}-${Date.now()}`,
        status: "active",
      }),
    );
  }

  async function handleCreateRule() {
    await runAction("Regra criada", () =>
      createRule(session, {
        name: `Auditoria automatica ${workspace.rules.length + 1}`,
        module: "reconciliation",
        priority: 90,
        scope: { channel: "Shopee" },
        definition: {
          conditions: { all: [{ field: "shippingAmount", operator: "gt", value: 50 }] },
          actions: [{ type: "mark_audit", severity: "medium" }],
        },
      }),
    );
  }

  const filteredPayouts = useMemo(
    () =>
      normalizedQuery
        ? recentPayouts.filter((row) =>
            row.some((value) => value.toLowerCase().includes(normalizedQuery)),
          )
        : recentPayouts,
    [normalizedQuery],
  );

  const filteredChannels = useMemo(
    () =>
      normalizedQuery
        ? channels.filter((channel) =>
            channel.name.toLowerCase().includes(normalizedQuery),
          )
        : channels,
    [normalizedQuery],
  );

  const userName = session.fullName || session.email.split("@")[0] || "Admin";
  const initials = userName.slice(0, 2).toUpperCase();

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
          <button>
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
            <button className="date-filter">
              <CalendarDays size={18} />
              01/05/2024 - 31/05/2024
              <ChevronDown size={18} />
            </button>
            <button className="header-icon notification">
              <Bell size={25} />
              <span>8</span>
            </button>
            <button className="header-icon">
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
            onExportErp={() => runAction("Exportacao ERP", () => exportErp(session), false)}
            onImportFile={handleImportFile}
            onInviteUser={() =>
              runAction("Convite enviado", () =>
                inviteUser(session, {
                  email: `financeiro+${Date.now()}@repassify.com`,
                  role: "finance_manager",
                }),
              )
            }
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
              {kpis.map((item) => {
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
                    <button className="active">Diário</button>
                    <button>Semanal</button>
                    <button>Mensal</button>
                  </div>
                  <MoreVertical size={22} />
                </PanelHeader>
                <LineAreaChart />
              </article>

              <article className="panel performance-panel">
                <PanelHeader title="Performance por canal">
                  <button className="select-button">
                    Valor conciliado <ChevronDown size={16} />
                  </button>
                </PanelHeader>
                <div className="performance-list">
                  {filteredChannels.map((channel) => (
                    <div key={channel.name} className="performance-row">
                      <ChannelBadge name={channel.name} />
                      <strong>{channel.name}</strong>
                      <span className="bar">
                        <i style={{ width: `${channel.percent}%` }} />
                      </span>
                      <em>{channel.value}</em>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel mix-panel">
                <PanelHeader title="Mix por canal" />
                <div className="mix-content">
                  <div className="donut">
                    <div>
                      <strong>R$ 12,48 mi</strong>
                      <span>Total</span>
                    </div>
                  </div>
                  <div className="mix-list">
                    {mix.map((item) => (
                      <div key={item.name}>
                        <span style={{ background: item.color }} />
                        <p>{item.name}</p>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
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
                      <tr key={row[3]}>
                        <td>{row[0]}</td>
                        <td>
                          <ChannelBadge name={row[1] ?? ""} /> {row[1]}
                        </td>
                        <td>{row[2]}</td>
                        <td>{row[3]}</td>
                        <td>{row[4]}</td>
                        <td>
                          <span className={`status ${row[6]}`}>{row[5]}</span>
                        </td>
                        <td>
                          <button className="eye-button">
                            <Eye size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="view-all">
                  Ver todos os repasses <span>→</span>
                </button>
              </article>

              <article className="panel rules-panel">
                <PanelHeader title="Motor de Regras">
                  <button className="link-button">Ver todas</button>
                </PanelHeader>
                <div className="rules-list">
                  {rules.map((rule) => (
                    <div key={rule[0]} className="rule-row">
                      <Workflow size={25} />
                      <span>{rule[0]}</span>
                      <b>→</b>
                      <strong>{rule[1]}</strong>
                      <em>{rule[2]}</em>
                    </div>
                  ))}
                </div>
                <button className="new-rule">+ Nova regra</button>
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
                    <strong>Olá, Lucas!</strong>
                    <p>
                      Sou seu assistente virtual e estou aqui para explicar cada
                      tela e ajudar nas suas análises.
                    </p>
                  </div>
                </div>
                <div className="assistant-questions">
                  <button>
                    O que significa divergência? <span>→</span>
                  </button>
                  <button>
                    Como funciona a conciliação? <span>→</span>
                  </button>
                  <button>
                    Quais canais têm mais divergências? <span>→</span>
                  </button>
                </div>
                <label className="assistant-input">
                  <input placeholder="Pergunte algo..." />
                  <button>
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

function LineAreaChart() {
  return (
    <div className="line-chart-wrap">
      <div className="chart-legend">
        <span>
          <i className="solid" /> Valor conciliado (R$)
        </span>
        <span>
          <i className="dash" /> Repasse previsto (R$)
        </span>
      </div>
      <div className="axis-labels">
        <span>R$ 2,5 mi</span>
        <span>R$ 2,0 mi</span>
        <span>R$ 1,5 mi</span>
        <span>R$ 1,0 mi</span>
        <span>R$ 0,5 mi</span>
        <span>R$ 0</span>
      </div>
      <svg
        className="line-chart"
        viewBox="0 0 760 290"
        role="img"
        aria-label="Evolucao dos repasses"
      >
        <defs>
          <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#1b5df2" stopOpacity="0.13" />
            <stop offset="100%" stopColor="#1b5df2" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[35, 78, 121, 164, 207, 250].map((y) => (
          <line key={y} x1="52" x2="735" y1={y} y2={y} className="grid-line" />
        ))}
        {[52, 164, 276, 388, 500, 612, 724].map((x) => (
          <line
            key={x}
            x1={x}
            x2={x}
            y1="35"
            y2="250"
            className="grid-vertical"
          />
        ))}
        <path
          className="area-path"
          d="M52 215 C80 145 105 105 132 132 C160 160 184 145 208 84 C232 62 257 72 278 118 C306 175 331 135 356 74 C384 90 405 86 430 70 C455 108 479 102 503 95 C530 138 558 124 584 86 C610 44 638 112 666 127 C695 150 715 119 735 128 L735 250 L52 250 Z"
        />
        <path
          className="solid-line"
          d="M52 215 C80 145 105 105 132 132 C160 160 184 145 208 84 C232 62 257 72 278 118 C306 175 331 135 356 74 C384 90 405 86 430 70 C455 108 479 102 503 95 C530 138 558 124 584 86 C610 44 638 112 666 127 C695 150 715 119 735 128"
        />
        <path
          className="dash-line"
          d="M52 232 C82 170 110 136 138 151 C169 170 190 158 215 119 C242 105 265 102 288 132 C315 152 340 115 365 98 C392 116 412 114 440 108 C465 108 492 104 516 128 C546 145 570 130 597 110 C626 126 654 143 681 158 C706 132 720 120 735 116"
        />
        <line x1="503" x2="503" y1="48" y2="250" className="hover-line" />
        <circle cx="503" cy="95" r="8" className="point-ring" />
      </svg>
      <div className="chart-tooltip">
        <span>21/05/2024</span>
        <p>Valor conciliado</p>
        <strong>R$ 1,72 mi</strong>
        <p>Repasse previsto</p>
        <strong>R$ 1,58 mi</strong>
      </div>
      <div className="chart-dates">
        <span>01 Mai</span>
        <span>06 Mai</span>
        <span>11 Mai</span>
        <span>16 Mai</span>
        <span>21 Mai</span>
        <span>26 Mai</span>
        <span>31 Mai</span>
      </div>
    </div>
  );
}

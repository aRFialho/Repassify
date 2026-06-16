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
  createCompany,
  createImport,
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
  getRules,
  getTenant,
  getUsers,
  inviteUser,
  previewImport,
  runReconciliation,
  simulateRule,
  startChannelAuth,
  syncChannel,
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
  onExportErp: () => void;
  onImportFile: (file: File | null) => void;
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
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  async function refreshWorkspace() {
    setWorkspaceStatus("loading");
    try {
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
          getDashboardSummary(session),
          getPayouts(session),
          getImports(session),
          getRules(session),
          getCompanies(session),
          getChannels(session),
          getChannelProviders(session),
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
    setActionMessage(message);
  }

  function handleAssistantQuestion(question: string) {
    setAssistantPrompt(question);
    setActionMessage("Assistente registrou a pergunta. A resposta sera ligada ao endpoint de IA quando configurado.");
  }

  function handleAssistantSend() {
    const prompt = assistantPrompt.trim();
    setActionMessage(
      prompt
        ? "Pergunta enviada para analise. Nenhuma resposta automatica foi gerada sem endpoint de IA configurado."
        : "Digite uma pergunta para o assistente.",
    );
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
            <button
              className="date-filter"
              onClick={() => {
                setPeriodLabel(periodLabel === "Periodo atual" ? "Todo historico real" : "Periodo atual");
                void refreshWorkspace();
              }}
              type="button"
            >
              <CalendarDays size={18} />
              {periodLabel}
              <ChevronDown size={18} />
            </button>
            <button
              className="header-icon notification"
              onClick={() => goToSection("Auditoria", "Abrindo divergencias reais da auditoria.")}
              type="button"
            >
              <Bell size={25} />
              <span>{workspace.issues.length}</span>
            </button>
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
                    <strong>Olá, Lucas!</strong>
                    <p>
                      Sou seu assistente virtual e estou aqui para explicar cada
                      tela e ajudar nas suas análises.
                    </p>
                  </div>
                </div>
                <div className="assistant-questions">
                  <button
                    onClick={() => handleAssistantQuestion("O que significa divergencia?")}
                    type="button"
                  >
                    O que significa divergência? <span>→</span>
                  </button>
                  <button
                    onClick={() => handleAssistantQuestion("Como funciona a conciliacao?")}
                    type="button"
                  >
                    Como funciona a conciliação? <span>→</span>
                  </button>
                  <button
                    onClick={() => handleAssistantQuestion("Quais canais tem mais divergencias?")}
                    type="button"
                  >
                    Quais canais têm mais divergências? <span>→</span>
                  </button>
                </div>
                <label className="assistant-input">
                  <input
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
                  <button onClick={handleAssistantSend} type="button">
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

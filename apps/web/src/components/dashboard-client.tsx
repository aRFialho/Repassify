"use client";

import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";
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
  userEmail: string;
  onLogout: () => void;
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

export function DashboardClient({
  apiStatus,
  userEmail,
  onLogout,
}: DashboardClientProps) {
  const [activeSection, setActiveSection] = useState("Dashboard");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

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

  const userName = userEmail.split("@")[0] || "Admin";
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
          <section className="panel module-panel">
            <PanelHeader title={activeSection} />
            <div className="module-state">
              <strong>{activeSection} conectado ao cockpit</strong>
              <p>
                Esta area ja responde ao menu e esta pronta para receber as
                telas de operacao, importacao e auditoria.
              </p>
            </div>
          </section>
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

# ChargeGuard UI/UX Design System

**Project:** ChargeGuard — Real-time EV Charging Station Monitoring & Incident Response
**Team:** OneNode (Solo Developer) · **Hackathon:** MUGVN Hackathon 2026
**Document Version:** 1.0 (19 October 2026)

---

## 1. Design Philosophy & Aesthetic Identity

ChargeGuard delivers a high-density, mission-critical operations command center for EV charging infrastructure. The visual direction is **Premium Dark Industrial / Modern Observability Command Center**—inspired by the precision, clarity, and information density of modern observability tools like Datadog and Linear, while remaining tailored specifically to EV charging telemetry and incident management.

### Core Principles
1. **Clarity Over Decoration:** Every visual element encodes real state. No meaningless glows, decorative animations, or distracting graphics.
2. **Tabular Precision:** Currents ($A$), energy ($kWh$), timestamps, and latency figures use monospace tabular numerals to prevent layout shifting during telemetry updates.
3. **Rigorous Data Provenance:** Clear visual indicators explicitly disclose whether data points are historical replays (`ACN_REPLAY`), calculated metrics (`DERIVED`), or simulated events (`SYNTHETIC`). Unmeasured sensors (e.g., voltage or temperature) are displayed as unavailable rather than fabricated.
4. **Resilient Information Architecture:** Every view provides dedicated states for Loading, Empty, Data Available, Stale/Offline, and Error with actionable next steps.

---

## 2. Design Tokens & Palette

### 2.1 Surfaces & Canvas (Dark Neutral Theme)
| Token | CSS / Tailwind | Hex Value | Purpose |
| :--- | :--- | :--- | :--- |
| `surface-canvas` | `bg-slate-950` | `#020617` | Main window background |
| `surface-panel` | `bg-slate-900/90` | `#0f172a` | Cards, sidebars, dashboard modules |
| `surface-elevated` | `bg-slate-800/80` | `#1e293b` | Dropdowns, dialogs, hover overlays |
| `border-subtle` | `border-slate-800` | `#1e293b` | Structural dividers, card borders |
| `border-prominent`| `border-slate-700` | `#334155` | Focused borders, active tabs |

### 2.2 Brand & Telemetry Accents
| Token | Hex Value | Meaning |
| :--- | :--- | :--- |
| `accent-primary` | `#06b6d4` (Cyan 500) | Active live stream, primary calls-to-action, telemetry pulse |
| `accent-secondary`| `#38bdf8` (Sky 400) | Secondary links, connector selectors |
| `accent-focus` | `#22d3ee` (Cyan 400) | Accessible focus rings (`ring-2 ring-cyan-400`) |

### 2.3 Semantic Status Tokens
Status communicates clearly through color, icon, and text combined:
| State | Badge BG / Text | Border | Icon | Semantic Meaning |
| :--- | :--- | :--- | :--- | :--- |
| **`AVAILABLE` / `OK`** | `bg-emerald-950/60 text-emerald-400` | `border-emerald-800` | `CheckCircle2` | Healthy, ready for charging |
| **`CHARGING` / `ACTIVE`** | `bg-cyan-950/60 text-cyan-400` | `border-cyan-800` | `Zap` | Active energy delivery |
| **`IDLE` / `UNPLUGGED`** | `bg-slate-800/60 text-slate-400` | `border-slate-700` | `Circle` | Connector ready, vehicle detached |
| **`WARNING` / `ACKNOWLEDGED`** | `bg-amber-950/60 text-amber-400` | `border-amber-800` | `AlertTriangle` | Under investigation / degraded |
| **`FAULT` / `CRITICAL`** | `bg-rose-950/60 text-rose-400` | `border-rose-800` | `AlertOctagon` | Simulated incident / zero current |

### 2.4 Data Provenance Tokens
Every sensor reading displays its lineage badge:
- **`ACN_REPLAY`**: `bg-blue-950/70 text-blue-300 border-blue-700/60` (Historical public EV charging session)
- **`DERIVED`**: `bg-purple-950/70 text-purple-300 border-purple-700/60` (Calculated state from current threshold)
- **`SYNTHETIC`**: `bg-amber-950/70 text-amber-300 border-amber-700/60` (Simulated fault / test stimulus)

---

## 3. Typography Scale & Hierarchy

- **Primary Typeface:** Clean system UI sans-serif (`font-sans`: Inter, Geist, system-ui)
- **Monospace Typeface:** Tabular numbers and code identifiers (`font-mono`: JetBrains Mono, Fira Code, monospace) with `tabular-nums`
- **Heading Hierarchy:**
  - `h1` (Page Title): `text-xl font-semibold text-slate-100 tracking-tight`
  - `h2` (Section Header): `text-base font-medium text-slate-200 tracking-tight`
  - `h3` (Card Title): `text-sm font-medium text-slate-300`
  - `body`: `text-xs md:text-sm text-slate-400 leading-relaxed`
  - `caption / metadata`: `text-[11px] font-mono text-slate-500 uppercase tracking-wider`

---

## 4. Layout & Grid Architecture

### Breakpoints
- **Desktop (1440px+):** Full 4-column metric grid + 2-column detail charts.
- **Laptop (1024px–1439px):** 3-column metric grid + stacked interactive charts.
- **Tablet (768px–1023px):** 2-column metric grid, collapsible incident drawers.
- **Mobile (390px–767px):** 1-column fluid flow, full-width touch-friendly actions (`touch-action: manipulation`, min hit-target 44×44px).

---

## 5. Accessibility & Interaction Matrix (WCAG 2.2 AA)

1. **Color Contrast:** All body text maintains minimum 4.5:1 contrast ratio against container surfaces; large headers maintain minimum 3:1.
2. **Keyboard Navigation:** All interactive cards, buttons, and tab controls are reachable via `Tab` with prominent `focus-visible:ring-2 focus-visible:ring-cyan-400` focus indicators.
3. **Screen Readers:** Non-text buttons have explicit `aria-label`; state badges include accompanying text; charts provide accessible table summaries.
4. **Motion Safety:** All transitions and telemetry pulses respect `@media (prefers-reduced-motion: reduce)`.

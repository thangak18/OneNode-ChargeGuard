# ChargeGuard — UI/UX Review & Usability Optimization Handoff

> **Target Agent**: Claude (or any senior frontend/UI-UX engineer)  
> **Repository**: `OneNode-ChargeGuard`  
> **Date**: November 2026  
> **Purpose**: Audit, evaluate, and optimize the user interface, page layouts, visual hierarchy, and usability of the ChargeGuard EV Operations Platform so that end-users and hackathon judges can understand and operate it effortlessly.

---

## 1. System Overview & Technical Context

* **Architecture**: Monorepo with two primary apps:
  * `apps/api`: NestJS 11 backend connected to MongoDB Atlas (time-series telemetry collection) and Datadog US1. Has an automated 8-second telemetry emission loop emitting real-time current samples for 5 virtual chargers.
  * `apps/web`: Next.js 16 App Router frontend with Tailwind CSS, Lucide icons, Recharts, and NextAuth (CredentialsProvider).
* **Design System**: Dark theme inspired by mission-control operations (`#030712` canvas, `#0f172a` card surface, `#22d3ee` Electric Cyan accent, `#10b981` Emerald for OK/Online, `#f59e0b` Amber for Warning/Stale/Guest, `#f43f5e` Rose for Incident/Fault). Defined in [docs/UI_UX_DESIGN_SYSTEM.md](file:///Volumes/Thang/OneNode-ChargeGuard/docs/UI_UX_DESIGN_SYSTEM.md).
* **Development Environment Requirement**:
  * **Critical Node.js runtime**: The system requires Node 24. On macOS, prefix all shell commands with:
    ```bash
    export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
    ```
  * Dev Servers currently run on:
    * Backend API: `http://127.0.0.1:3001`
    * Frontend Web: `http://127.0.0.1:3000`

---

## 2. Recent Architectural & UI Changes (Current Baseline)

1. **Authentication Replaced with CredentialsProvider**:
   * Removed external GitHub OAuth dependency.
   * File [apps/web/src/lib/auth-options.ts](file:///Volumes/Thang/OneNode-ChargeGuard/apps/web/src/lib/auth-options.ts) and [apps/web/src/app/login/page.tsx](file:///Volumes/Thang/OneNode-ChargeGuard/apps/web/src/app/login/page.tsx) now support instant Email & Password sign-in:
     * Credentials: `operator@chargeguard.com` / `admin` (or `admin` / `admin`).
     * Click-to-fill chips provided on `/login` for 1-click authentication.
     * When authenticated, assigns operator identity `Lead Operations Engineer` (`138879141`) matching the system audit allowlist.
2. **Judge Run Hidden**:
   * Removed `Judge Run` from the navigation sidebar and mobile drawer in [apps/web/src/components/Navbar.tsx](file:///Volumes/Thang/OneNode-ChargeGuard/apps/web/src/components/Navbar.tsx).
3. **Demo Renamed to "Incident Drill"**:
   * Renamed from "Demo Controls" to **"Incident Drill"** (`Incident Drill & Fault Simulation Lab` on `/demo`).
4. **Data Provenance Popover**:
   * Replaced the large banner at the top of `/` with a compact, interactive popover badge: `SYNTHETIC TELEMETRY (i)`.
5. **Role-Based Access Control (RBAC) Implemented**:
   * Root wrapped with `<Providers>` in [apps/web/src/components/Providers.tsx](file:///Volumes/Thang/OneNode-ChargeGuard/apps/web/src/components/Providers.tsx) & [apps/web/src/app/layout.tsx](file:///Volumes/Thang/OneNode-ChargeGuard/apps/web/src/app/layout.tsx).
   * **Guest Mode (Read-Only)**:
     * Sidebar displays amber badge: `GUEST PREVIEW · READ ONLY` with link `Sign in as Operator`.
     * Can view all telemetry, charts, connector status, and historical data.
     * State mutation buttons (`+ Report Incident`, `Acknowledge`, `Resolve`, and drill triggers) are locked with lock icons `🔒` and link to `/login`.
   * **Operator Mode (Mutate OK)**:
     * Sidebar displays green badge: `🟢 OPERATOR ACTIVE · MUTATE OK` with operator email and `Sign Out` button.
     * Full access to dispatch incidents (`+ Report Incident` modal), acknowledge alerts, resolve incidents, and trigger drills.
     * Audit log in MongoDB Atlas records `operator@chargeguard.com` as the action actor.
6. **Unit Tests**:
   * All 29 unit tests in `apps/web/test/` pass cleanly (`npm test`).

---

## 3. Pages & File Map to Review

| Route | Main Component File | Description & Current Features |
| :--- | :--- | :--- |
| **`/`** | [apps/web/src/app/page.tsx](file:///Volumes/Thang/OneNode-ChargeGuard/apps/web/src/app/page.tsx) | **Operations Overview**: 4 top KPI cards (Freshness, Active Current, Connectors 5/5, Telemetry Records), Bar chart of connector current, Active Incident Queue preview, and 5 Charger Cards with live meters. |
| **`/chargers`** | [apps/web/src/app/chargers/page.tsx](file:///Volumes/Thang/OneNode-ChargeGuard/apps/web/src/app/chargers/page.tsx) | **Charger Detail**: Selector for connectors `demo-charger-01` to `05`, detailed voltage/current/power metrics, historical line chart, and telemetry metadata. |
| **`/incidents`** | [apps/web/src/app/incidents/page.tsx](file:///Volumes/Thang/OneNode-ChargeGuard/apps/web/src/app/incidents/page.tsx) | **Incident Management**: Status filter tabs (ALL, OPEN, ACKNOWLEDGED, RESOLVING, RESOLVED), 2-column queue + detail drawer, Datadog correlation info, audit action timeline, and `+ Report Incident` modal. |
| **`/demo`** | [apps/web/src/app/demo/page.tsx](file:///Volumes/Thang/OneNode-ChargeGuard/apps/web/src/app/demo/page.tsx) | **Incident Drill Lab**: 4-step interactive lifecycle progress (Baseline -> Fault -> Recovery -> Resolved), scenario selector (Overheat, Power Loss, Hardware Fault), and trigger buttons. |
| **`/login`** | [apps/web/src/app/login/page.tsx](file:///Volumes/Thang/OneNode-ChargeGuard/apps/web/src/app/login/page.tsx) | **Operator Sign-In**: Credentials form with quick-fill pills, password visibility toggle, error banners, and authenticated operator profile card. |
| **Global Nav** | [apps/web/src/components/Navbar.tsx](file:///Volumes/Thang/OneNode-ChargeGuard/apps/web/src/components/Navbar.tsx) | **Desktop Sidebar & Mobile Drawer**: Brand header, navigation links, MongoDB/Datadog service status badges, and dynamic Guest/Operator session card. |

---

## 4. Claude's Review Objectives & Optimization Scope

Please evaluate the UI/UX with a focus on **first-time clarity, visual hierarchy, and ease of operation for judges and users**:

### A. Layout & Information Architecture
1. **Visual Balance on `/` (Overview)**:
   * Do the 4 metric cards, the charging current chart, and the incident preview grid look cohesive and well-proportioned?
   * Is the transition from high-level fleet overview down to individual virtual connectors smooth?
2. **Incident Queue & Triage Workflow on `/incidents`**:
   * Is the 2-column split (Left: Queue list; Right: Incident detail & audit timeline) clear on both wide screens and smaller laptops?
   * When there are no active incidents, does the empty state look reassuring or empty?
   * Are the status transitions (`OPEN` $\to$ `ACKNOWLEDGED` $\to$ `RESOLVING` $\to$ `RESOLVED`) visually distinct and easy to follow?
3. **Interactive Simulation on `/demo`**:
   * Does the 4-step lifecycle bar (Step 1 Baseline $\to$ Step 2 Fault $\to$ Step 3 Recovery $\to$ Step 4 Resolved) clearly communicate what is happening in real-time?
   * Are the scenario selector dropdowns clear, with helpful explanatory labels?
4. **Charger Detail on `/chargers`**:
   * Is it immediately clear how to switch between the 5 chargers?
   * Are technical values (Amperes, Kilowatts, Volts) presented with clear units and human-friendly labels?

### B. Usability & User Journey
1. **Guest vs Operator Experience**:
   * Is it immediately obvious to a visiting user/judge what they can do as a Guest (explore & monitor) versus what requires Operator sign-in (dispatch & resolve)?
   * Are the lock indicators `🔒` and sign-in prompts encouraging and frictionless rather than punitive or intrusive?
2. **Tooltips & Micro-copy**:
   * Check labels, button texts, and helper descriptions for concise, professional wording (EV fleet terminology, no developer jargon leaks).
3. **Empty States & Loading Feedback**:
   * Ensure spinners, skeleton loaders, or polling refresh indicators feel snappy and do not cause layout shifts.

### C. Responsiveness & Accessibility
1. **Mobile & Drawer Experience**:
   * Verify mobile header bar, hamburger drawer toggle, and card responsiveness on screens $< 1024\text{px}$.
2. **Color Contrast & Focus Rings**:
   * Ensure contrast meets WCAG AA standards against the dark background (`#030712` / `#0f172a`).
   * Ensure interactive buttons and inputs have visible cyan focus rings (`focus-visible:ring-2 focus-visible:ring-cyan-500`).

---

## 5. Verification Commands & Guardrails

When inspecting or applying UI modifications, always execute the following verification steps:

```bash
# Set Node 24 runtime environment
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"

# 1. Typecheck frontend
cd apps/web && npx tsc --noEmit

# 2. Lint check frontend
cd apps/web && npm run lint

# 3. Run all unit tests (must pass 29/29)
cd apps/web && npm test
```

### Critical Guardrails:
* **Preserve policy & audit integrity**: Do not alter `apps/web/src/lib/*policy*` or remove actor attribution (`operator@chargeguard.com`).
* **Preserve dark navy/cyan visual theme**: Do not change colors to generic white or unrelated palettes.
* **Keep live servers running**:
  * Backend API on `127.0.0.1:3001`
  * Frontend on `127.0.0.1:3000`


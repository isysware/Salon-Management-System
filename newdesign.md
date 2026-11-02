# SalonSys Platform Portal — Visual Design System & UI Specification (`newdesign.md`)

**Document Version:** 1.0.0 (Production Architecture Specification)  
**Author:** Principal SaaS Product Designer & Enterprise Frontend Architect  
**Visual Source of Truth:** Existing Salon Operations Application (`frontend/src/index.css`, `frontend/src/components/`, `design.md`)  
**Scope:** Standalone Platform Master Admin Portal (`platform-portal`) — Design tokens, visual glassmorphism stack, responsive breakpoints, UI component primitives, dense table specifications, and page-by-page wireframe blueprints.

---

> [!IMPORTANT]
> **REJECTED DESIGN OVERRIDE NOTICE:**  
> The legacy `platform-portal` mockup UI has been officially rejected by stakeholders. This document establishes an entirely new, unified design system derived 100% from the verified luxury glassmorphism design language of the **Salon Operations App** (`frontend/src/`). The Platform Portal must feel like an executive, high-end command center sharing the same visual DNA, typography, color harmony, and component standards as SalonSys.

---

## 1. Executive Aesthetic Vision & Engineering Principles

The SalonSys design language is engineered around an **Ultra-Premium Borderless Frosted Glassmorphism** aesthetic. Designed for executive control, high-volume tenant management, and rapid administrative auditing, the interface harmonizes luxury visual polish with extreme data density.

### 1.1 Core Design Pillars

1. **Depth Without Harsh Rigid Lines:**  
   Harsh, solid, opaque borders (`border-slate-300`, `border-gray-400`) are strictly eliminated. Surface boundaries are delineated through **soft specular edge reflections** (`border border-white/80` or `border border-white/90`) paired with subtle inner highlights (`shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)]`).
   *(Source: `frontend/src/components/ui/card.tsx:39-44`, `design.md:15`)*

2. **Hardware-Accelerated Frosted Glass Layering:**  
   All primary surfaces utilize hardware-accelerated backdrop blur (`backdrop-blur-2xl`, `backdrop-saturate-150`). When floating above warm ambient background lighting orbs, frosted glass containers produce a tactile, high-end feel.
   *(Source: `frontend/src/components/ui/card.tsx:40-42`, `design.md:16`)*

3. **Signature Rose Velvet Berry & Wine Palette:**  
   The platform uses rich velvet wine gradients for primary metric hero cards (`#9D2558`, `#851C47`, `#550C2C`), paired with pure white frosted glass surfaces and the signature **Rose Velvet Berry** accent (`#B82E69`).
   *(Source: `frontend/src/index.css:41-49`, `design.md:27-36`)*

4. **Zero Layout Shift (CLS = 0) & Dense Readability:**  
   Administrative dashboards require rock-solid tabular data presentation without jumping layouts. Dropdowns and modals employ Radix scroll-lock neutralization (`scrollbar-gutter: stable`). Tables use fixed headers, tabular numeric fonts (`font-variant-numeric: tabular-nums`), and clean row padding.
   *(Source: `frontend/src/index.css:63-75`, `113-116`)*

### 1.2 Unified Production Tech Stack Specification
To ensure 100% build compatibility and zero UI drift, the Platform Portal (`platform-portal`) must be built with the exact production tech stack used by the Salon Operations App (`frontend/`):

* **Frontend Engine:** React `^19.0.1` + React-DOM `^19.0.1`
* **Build System:** Vite `^8.3.0` with `@vitejs/plugin-react` `^6.1.1`
* **Styling Framework:** Tailwind CSS v4 `^4.3.3` via `@tailwindcss/vite` `^4.3.3`
* **Language & Types:** TypeScript `^7.0.2` (strict mode)
* **Headless UI Primitives:** Radix UI (`@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-select`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `@radix-ui/react-checkbox`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-separator`, `@radix-ui/react-slot`)
* **Iconography:** `lucide-react` `^0.546.0`
* **Micro-Animations:** `motion` `^12.23.24`
* **Variant Management:** `class-variance-authority` `^0.7.1`, `clsx` `^2.1.1`, `tailwind-merge` `^3.7.0`
* **Export Utilities:** `jspdf` `^4.2.1`, `html2canvas-pro` `^2.5.2`, `xlsx` `^0.18.5`
* **Backend Runtime:** Node.js v24.x ESM, Express `^5.2.1`, Prisma `^5.22.0`, PostgreSQL 18.x
* **Port Bindings:** Platform Portal on `:3002`, Salon App on `:3001`, Backend API on `:5000`

---

## 2. Design Tokens & Color Palette

### 2.1 Brand & Neutral Color Tokens
*(Verified from `frontend/src/index.css:34-57` and `design.md:24-36`)*

| Token Name | HEX / Value | Tailwind Class | UI Usage & Context | Implementation Status |
| :--- | :--- | :--- | :--- | :--- |
| **Rose Velvet Berry (Primary)** | `#B82E69` | `bg-[#B82E69]`, `text-[#B82E69]` | Active navigation pills, primary CTAs, brand accents, focus rings | `Already implemented — source se verified` |
| **Rose Berry Hover** | `#851C47` | `hover:bg-[#851C47]` | Hover state for interactive primary buttons and action pills | `Already implemented — source se verified` |
| **Rose Berry Active** | `#6F1339` | `active:bg-[#6F1339]` | Pressed state for primary action buttons | `Already implemented — source se verified` |
| **Deep Velvet Plum** | `#550C2C` | `to-[#550C2C]` | Deep dark gradient anchor for hero revenue stat cards | `Already implemented — source se verified` |
| **Blush Rose Tint (Surface)** | `#FDF2F5` | `bg-[#FDF2F5]`, `text-[#B82E69]` | Filter pill containers, table hover highlight, active tab background | `Already implemented — source se verified` |
| **Secondary Accent Pill** | `#FCE8EC` | `bg-[#FCE8EC]`, `text-[#9D2558]` | Secondary buttons, subtle alert badges, count indicators | `Already implemented — source se verified` |
| **Canvas Background** | `#FAF8F9` | `bg-[#FAF8F9]` | Global body background; warm ivory pearl off-white | `Already implemented — source se verified` |
| **Charcoal Dark Heading** | `#18191B` | `text-[#18191B]` | Primary headers (H1-H3), metric numbers, tenant names | `Already implemented — source se verified` |
| **Deep Body Foreground** | `#23151D` | `text-[#23151D]` | Standard body copy, table cell content | `Already implemented — source se verified` |
| **Muted Slate Mauve** | `#78616C` | `text-[#78616C]` | Subtitles, helper text, timestamps, metric labels, inactive nav icons | `Already implemented — source se verified` |
| **Light Mauve Subtle** | `#A38D98` | `text-[#A38D98]` | Group headers, disabled icons, micro descriptions, breadcrumb dividers | `Already implemented — source se verified` |
| **Subtle Border Line** | `#E2E8F0` | `border-[#E2E8F0]` | Table row dividers, input field borders (when glass is disabled) | `Already implemented — source se verified` |
| **Frosted White Surface** | `#FFFFFF` | `bg-white/75` | Standard card surface with backdrop blur | `Already implemented — source se verified` |

### 2.2 Semantic & Status Tokens
*(Verified from `frontend/src/components/ui/badge.tsx:9-20` and `frontend/src/components/ui/stat-card.tsx:43-64`)*

| Status / Intent | Badge Background | Badge Text | Border | Dot Color | Platform Portal Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Active / Verified** | `bg-emerald-50` | `text-emerald-700` | `border-emerald-200` | `bg-emerald-500` | Active Tenant, Verified Payment Proof, Active Subscription |
| **Trial / In Progress** | `bg-sky-50` | `text-sky-700` | `border-sky-200` | `bg-sky-500` | Trialing Tenant (`TRIAL`), New Registration |
| **Pending Verification** | `bg-amber-50` | `text-amber-700` | `border-amber-200` | `bg-amber-500` | Payment Proof `PENDING_VERIFICATION`, Grace Period Active |
| **Suspended / Danger** | `bg-rose-50` | `text-rose-700` | `border-rose-200` | `bg-rose-500` | Suspended Tenant (`SUSPENDED`), Rejected Payment, Quota Exceeded |
| **Past Due / Warning** | `bg-orange-50` | `text-orange-700` | `border-orange-200` | `bg-orange-500` | Subscription `PAST_DUE`, Expiring in < 3 days |
| **Cancelled / Inactive** | `bg-slate-100` | `text-slate-600` | `border-slate-200` | `bg-slate-400` | Cancelled Tenant (`CANCELLED`), Deprecated Plan Version |

---

## 3. Ambient Lighting & Canvas Architecture

The frosted glass aesthetic is powered by hardware-accelerated ambient color gradients placed behind the transparent canvas in the application shell.

### 3.1 Production Ambient Light Mesh
*(Verified from `frontend/src/components/layout/AppShell.tsx` & `design.md:80-87`)*

```html
<!-- Ambient Luxury Blur Glow Lights (Fixed Under Transparent Canvas) -->
<div class="fixed -top-20 -left-20 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#FCE4EC]/65 via-[#F8BBD0]/35 to-transparent blur-[140px] pointer-events-none -z-0" />
<div class="fixed top-[20%] -right-20 w-[650px] h-[650px] rounded-full bg-gradient-to-bl from-[#FFF0F5]/80 via-[#F8D2DC]/45 to-transparent blur-[150px] pointer-events-none -z-0" />
<div class="fixed top-[55%] left-[20%] w-[550px] h-[550px] rounded-full bg-gradient-to-tr from-[#FCE8EC]/50 via-[#F4DDE5]/40 to-transparent blur-[130px] pointer-events-none -z-0" />
<div class="fixed -bottom-24 right-[30%] w-[700px] h-[500px] rounded-full bg-gradient-to-tr from-[#FAF0F3]/75 via-[#FCE4EC]/35 to-transparent blur-[160px] pointer-events-none -z-0" />
```

### 3.2 Elevation & Specular Reflection Tokens
*(Verified from `frontend/src/components/ui/card.tsx:38-49`)*

```css
/* Card Elevation: Glass Standard */
border: 1px solid rgba(255, 255, 255, 0.9);
background: rgba(255, 255, 255, 0.75);
backdrop-filter: blur(24px) saturate(150%);
box-shadow: 0 10px 35px rgba(35, 21, 29, 0.035), inset 0 1.5px 2px rgba(255, 255, 255, 1);
border-radius: 20px; /* sm:rounded-[24px] */

/* Card Hover Lift */
transition: all 300ms cubic-bezier(0.16, 1, 0.3, 1);
hover:box-shadow: 0 18px 45px rgba(184, 46, 105, 0.08);
hover:border-color: #ffffff;
hover:transform: translateY(-2px);
```

---

## 4. Typography & Font Hierarchy

### 4.1 Fonts
* **Primary Sans-Serif:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`  
  *(Source: `frontend/src/index.css:4-5`)*
* **Financial Figures & Metrics:** `'Inter', tabular-nums` or `font-mono tabular-nums` for precise alignment of revenue figures, branch codes, and transaction references.  
  *(Source: `frontend/src/index.css:113-116`)*

### 4.2 Typographic Scale Table
*(Verified from `design.md:97-107`)*

| Element | Font Size | Weight | Tracking | Numbers | Tailwind Class Recipe |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Page Title (H1)** | 24px–28px (`text-2xl sm:text-3xl`) | `font-bold` | `tracking-tight` | Standard | `text-2xl sm:text-3xl font-bold tracking-tight text-[#18191B]` |
| **Section Header (H2)** | 18px–20px (`text-lg sm:text-xl`) | `font-bold` | `tracking-tight` | Standard | `text-lg sm:text-xl font-bold tracking-tight text-[#18191B]` |
| **Card Title (H3)** | 14px–15px (`text-sm sm:text-base`) | `font-semibold` | `tracking-tight` | Standard | `text-sm sm:text-base font-semibold text-[#18191B] tracking-tight` |
| **Hero KPI Value** | 30px–36px (`text-3xl sm:text-4xl`) | `font-bold` | `tracking-tight` | Tabular | `text-3xl sm:text-4xl font-bold tracking-tight text-[#18191B] tabular-nums` |
| **Table Header** | 12px–13px (`text-xs sm:text-[13px]`) | `font-semibold` | `tracking-wide` | Standard | `text-[12px] font-semibold text-[#78616C] uppercase tracking-wider` |
| **Table Body Text** | 13px (`text-[13px]`) | `font-medium` | Normal | Tabular | `text-[13px] font-medium text-[#23151D] tabular-nums leading-5` |
| **Subtitles / Helpers** | 12px (`text-xs`) | `font-normal` | Normal | Standard | `text-xs text-[#78616C] font-normal` |
| **Micro Badge Label** | 10px–11px (`text-[11px]`) | `font-bold` | `tracking-wider` | Standard | `text-[11px] font-bold uppercase tracking-wider` |

---

## 5. Navigation & Structural Layout Patterns

### 5.1 Sidebar Specification
The Platform Portal uses the same dual-state sidebar architecture as the Salon App (`frontend/src/components/layout/Sidebar.tsx`):

```
+--------------------------------------------------------------------------------------------------+
| COLLAPSED STATE (w-20 / 80px)               | EXPANDED STATE (w-72 / 288px)                      |
|---------------------------------------------|----------------------------------------------------|
| [Floating Logo Pill: w-11 h-11]             | [Brand Header: SalonSys Master Admin Console]      |
|                                             |                                                    |
| [Floating Capsule Dock: w-[54px]]           | [Navigation Groups]                                |
|   - Dashboard Icon                          |   PLATFORM OVERVIEW                                |
|   - Tenants Icon                            |     ├── Executive Dashboard                        |
|   - Plans Icon                              |     └── Platform Analytics                         |
|   - Payments Icon (with badge)              |   TENANT OPERATIONS                                |
|   - Audit Log Icon                          |     ├── All Salons & Tenants                       |
|                                             |     ├── Onboard New Salon (Wizard)                 |
| [Bottom Utility Dock: w-[54px]]             |     └── Tenant Suspensions & Health                |
|   - Platform Settings                       |   COMMERCIALS & BILLING                            |
|   - Admin Logout                            |     ├── SaaS Plans & Versions                      |
|                                             |     └── Payment Proof Inbox (Badge: 4)             |
|                                             |   SECURITY & AUDITING                              |
|                                             |     ├── Platform Audit Events                      |
|                                             |     └── Master Admin Users                         |
|                                             |                                                    |
|                                             | [Bottom Profile Card: Admin Name + Logout Button]  |
+--------------------------------------------------------------------------------------------------+
```

#### Exact Sidebar Styling Classes:
* **Expanded Container:** `h-full max-h-screen bg-white/75 backdrop-blur-2xl border-0 flex flex-col transition-all duration-200 select-none overflow-hidden text-slate-800 shadow-[4px_0_28px_rgba(35,21,29,0.025)] relative z-20 w-72`  
  *(Source: `Sidebar.tsx:171-173`)*
* **Collapsed Container:** `h-full max-h-screen bg-white/70 backdrop-blur-2xl border-0 flex flex-col justify-between py-3.5 px-2 select-none overflow-hidden text-slate-800 relative z-20 w-20 transition-all duration-200 shadow-[4px_0_24px_rgba(35,21,29,0.02)]`  
  *(Source: `Sidebar.tsx:95-97`)*
* **Active Nav Item Pill:** `bg-[#B82E69] text-white font-bold shadow-[0_2px_8px_rgba(184,46,105,0.22)] rounded-xl px-3 py-2 text-[13px]`  
  *(Source: `Sidebar.tsx:232`)*
* **Inactive Nav Item Pill:** `text-[#55424E] hover:text-[#18191B] hover:bg-[#FAF8F9] rounded-xl px-3 py-2 text-[13px] font-semibold transition-all duration-150`  
  *(Source: `Sidebar.tsx:235`)*

### 5.2 Topbar Header Specification
*(Verified from `frontend/src/components/layout/Header.tsx:150-250`)*

* **Height:** `h-16` (64px)
* **Surface:** `bg-white/70 backdrop-blur-2xl border-b border-white/80 shadow-[0_4px_20px_rgba(35,21,29,0.02)]`
* **Left Zone:**
  * Desktop sidebar toggle button (`PanelLeft` / `PanelLeftClose`)
  * Breadcrumb navigation (`Home / Tenants / Meerab Salon Main`)
* **Right Zone:**
  * Global Search Input (`Ctrl + K`) for instant salon lookup by name, slug, or owner email.
  * Pending Payment Proofs quick alert button with animated ping indicator.
  * Environment Badge: `PRODUCTION` (Emerald) or `STAGING` (Amber).
  * Master Admin Profile Menu with avatar, role badge (`SUPER_ADMIN`), and Logout action.

---

## 6. Core Component Library Specifications

### 6.1 Hero & KPI Metric Cards
*(Verified from `frontend/src/components/ui/stat-card.tsx` and `design.md:113-153`)*

The Platform Portal requires two distinct card tiers:

#### Tier 1: Velvet Hero Stat Cards (Primary Executive Highlights)
* **Used for:** Total Active MRR, Total Onboarded Salons, Pending Slip Approvals.
* **Surface:** `rounded-[24px] p-5 sm:p-6 text-white border border-white/20 shadow-sm relative overflow-hidden group transition-all duration-300 hover:shadow-md`
* **Gradients:**
  * **MRR Card:** `bg-gradient-to-br from-[#9D2558] via-[#851C47] to-[#550C2C]`
  * **Active Tenants:** `bg-gradient-to-br from-[#B82E69] via-[#9B2A5A] to-[#801D48]`
  * **Pending Verification:** `bg-gradient-to-br from-[#A84B68] via-[#8F3B54] to-[#752B41]`
* **Watermark:** Stylized SVG iconography positioned at `-right-3 -bottom-3`, `w-28 h-28`, `opacity-15`, scaling to `110%` on card hover. Strictly NO opaque corner patches.

#### Tier 2: Frosted White KPI Cards (System Metrics)
* **Used for:** Total Branches, Active User Accounts, Trial Salons, Suspended Salons.
* **Surface:** `rounded-[24px] p-5 sm:p-6 bg-white/75 backdrop-blur-2xl border border-white/90 shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white transition-all duration-300`
* **Rule:** Clean, distraction-free typography with icon capsule in `w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80`.

### 6.2 High-Density Administrative Tables (`.report-records`)
*(Verified from `frontend/src/index.css:118-183`)*

Administrative tables must present 10 to 50 rows per page cleanly without oversized whitespace.

```css
/* Table Master CSS Specification */
.platform-records {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
  text-align: left;
}

/* Sticky Header */
.platform-records > thead > tr > th {
  background: #FDF2F5;
  color: #475569;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  padding: 12px 16px;
  border-bottom: 1px solid #CBD5E1;
  border-right: 1px solid #E2E8F0;
  position: sticky;
  top: 0;
  z-index: 10;
}

/* Alternating Rows & Cell Padding */
.platform-records > tbody > tr > td {
  padding: 12px 16px;
  border-bottom: 1px solid #E2E8F0;
  border-right: 1px solid #E2E8F0;
  vertical-align: middle;
  background-color: #FFFFFF;
}

.platform-records > tbody > tr:nth-child(even) > td {
  background-color: #F8FAFC;
}

.platform-records > tbody > tr:hover > td {
  background-color: #FDF2F5;
}

.platform-records > tbody > tr > td:last-child,
.platform-records > thead > tr > th:last-child {
  border-right: 0;
}
```

### 6.3 Buttons & Actions
*(Verified from `frontend/src/components/ui/button.tsx:12-20`)*

* **Primary Action:** `bg-[#9D2558] text-white shadow-xs hover:bg-[#851C47] active:bg-[#6F1339] rounded-xl px-4 py-2 text-sm font-semibold transition-all cursor-pointer`
* **Secondary Pill:** `bg-[#FCE8EC] text-[#9D2558] shadow-2xs hover:bg-[#FAD9E1] rounded-xl px-4 py-2 text-sm font-semibold transition-all cursor-pointer`
* **Outline / Subtle:** `border border-[#F1DEE3] bg-white text-[#23151D] shadow-2xs hover:bg-[#FDF2F4] hover:text-[#9D2558] hover:border-[#E8CAD2] rounded-xl px-3.5 py-2 text-sm font-medium`
* **Destructive Action:** `bg-rose-600 text-white shadow-xs hover:bg-rose-700 active:bg-rose-800 rounded-xl px-4 py-2 text-sm font-semibold`
* **Ghost / Icon Action:** `text-[#5A4650] hover:bg-[#FDF2F4] hover:text-[#9D2558] rounded-lg p-2 transition-colors`

### 6.4 Form Inputs, Selects & Filters
*(Verified from `frontend/src/index.css:95-104` and `frontend/src/components/ui/input.tsx`)*

* **Form Input:** `h-10 px-3.5 rounded-xl border border-slate-200/90 bg-white/90 text-sm text-[#18191B] placeholder:text-slate-400 focus:border-[#9D2558] focus:ring-2 focus:ring-[#FCE8EC] transition-all outline-none`
* **Filter Capsule Container:** `p-1 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/80 shadow-2xs inline-flex items-center gap-1`
* **Active Filter Pill:** `px-3 py-1.5 rounded-xl text-xs font-bold bg-[#B82E69] text-white shadow-xs transition-all`
* **Inactive Filter Pill:** `px-3 py-1.5 rounded-xl text-xs font-semibold text-[#78616C] hover:text-[#18191B] hover:bg-[#FDF2F5] transition-all`

---

## 7. Responsive Breakpoint Matrix

The Platform Portal must be fully functional across all device sizes:

| Breakpoint | Window Width | Layout Strategy |
| :--- | :--- | :--- |
| **Desktop Wide (XL)** | `≥ 1280px` | Full expanded sidebar (`w-72`), 4-column metric grid, full-width high-density tables with inline action buttons. |
| **Desktop Normal (LG)** | `1024px – 1279px` | Collapsed capsule dock sidebar (`w-20`), 4-column or 3-column metric grid, tables with sticky right-action column. |
| **Tablet (MD)** | `768px – 1023px` | Collapsed capsule dock (`w-20`), 2-column metric grid, horizontal table scroll with visible scrollbar indicators. |
| **Mobile (SM / XS)** | `< 768px` | Hidden sidebar; slide-out glass drawer overlay (`MobileDrawer.tsx`). 1-column stacked stat cards. Dense tables switch to card-based record tiles. Modal dialogs full-screen on mobile (`w-full h-full rounded-none`). |

---

## 8. Page-by-Page Wireframe Specifications

### 8.1 Executive Platform Dashboard (`/`)

```
+---------------------------------------------------------------------------------------------------+
| Topbar: SalonSys Platform Control | Search Salons [Ctrl+K] | [🔔 3 Pending Slips] | [Super Admin]  |
+---------------------------------------------------------------------------------------------------+
| ROW 1: HERO METRICS (4 Columns)                                                                  |
| [ Total Tenants: 14 ]  [ Active MRR: PKR 385,000 ]  [ Pending Slips: 3 ]  [ Active Branches: 28 ] |
| (Hero Velvet Berry)    (Hero Velvet Wine)           (Amber Highlight)     (Frosted White)        |
+---------------------------------------------------------------------------------------------------+
| ROW 2: SPLIT OPERATIONAL CONSOLE (8 Cols / 4 Cols)                                                |
| +-----------------------------------------------+ +-----------------------------------------------+ |
| | PENDING PAYMENT SLIP INBOX (8 Cols)           | | PLATFORM AUDIT PULSE (4 Cols)                 | |
| | - Salons waiting for subscription extension   | | - Real-time administrative activity stream    | |
| | --------------------------------------------- | | - 10:45 AM: Tenant 'Glow Salon' Onboarded     | |
| | Table: Tenant | Plan | Amount | Ref # | Action | | - 09:30 AM: Slip #TX-9821 Verified (1-Click)  | |
| | [Royal Salon | Pro | PKR 25,000 | [Review]]   | | - Yesterday: Plan 'Growth' Quota Updated      | |
| +-----------------------------------------------+ +-----------------------------------------------+ |
+---------------------------------------------------------------------------------------------------+
| ROW 3: RECENT SALONS & SYSTEM HEALTH                                                             |
| Full-width table: Name | Slug | Owner Email | Status | Branches | Next Renewal | Actions             |
+---------------------------------------------------------------------------------------------------+
```

### 8.2 Tenant Management Directory (`/tenants`)

* **Header:** Title `"Salons & Tenants"`, count badge `"(14 Total)"`, and primary CTA `"+ Onboard New Salon"`.
* **Filter Bar:**
  * Search input: Filter by Salon Name, Slug, or Owner Phone.
  * Status Filter Pills: `All (14)` | `Active (10)` | `Trial (2)` | `Past Due (1)` | `Suspended (1)`.
  * Plan Filter Dropdown: `All Plans` | `Starter` | `Growth` | `Pro` | `Custom`.
* **Table Columns:**
  1. **Salon Entity:** Name + Slug badge (e.g., `Meerab Salon Main` `[meerab-main]`).
  2. **Owner Profile:** User Name + Email + Phone number.
  3. **Subscription Status:** Status badge (`ACTIVE` green, `TRIAL` blue, `SUSPENDED` rose).
  4. **Active Plan:** Plan Name + Billing Cycle (`MONTHLY` / `ANNUAL`).
  5. **Scale:** Branch count (`3 Branches`) + Staff count (`24 Staff`).
  6. **Current Period End:** Date (`15 Nov 2026`) + Days remaining countdown pill.
  7. **Actions Menu:** Three-dots dropdown (`Inspect Details`, `Suspend / Reactivate`, `Audit Log`).

### 8.3 New Tenant Onboarding Wizard (`/tenants/new` or Modal)

A 4-step atomic provisioning wizard:

* **Step 1: Business Profile**
  * Business Legal Name (`name`): e.g. `"Luxe Beauty Studio"`
  * URL Slug (`slug`): e.g. `"luxe-beauty"` (auto-formatted, checks live uniqueness)
  * Business Contact Email & Phone
* **Step 2: Primary Branch Setup**
  * Initial Branch Name (`branchName`): e.g. `"DHA Phase 5 Flagship"`
  * Branch Address, City (`branchCity`), Branch Phone
* **Step 3: Owner Account Credentials**
  * Owner Full Name (`ownerName`)
  * Login Email (`ownerEmail`): Must be unique
  * Initial Password (`ownerPassword`): Auto-generate option with 1-click copy
* **Step 4: Subscription & Plan Assignment**
  * Select Plan from active catalog (`Starter`, `Growth`, `Pro`)
  * Select Billing Cycle: `MONTHLY` or `ANNUAL`
  * Summary Preview of assigned quotas and limits.
* **Footer:** `[Cancel]` and `[Create & Provision Salon Company]` (Triggers atomic backend transaction).

### 8.4 Payment Proof Verification Desk (`/payments/pending`)

Split-screen review layout optimized for fast slip verification:

```
+---------------------------------------------------------------------------------------------------+
| LEFT PANE: SLIP ATTACHMENT VIEWER (60% Width)   | RIGHT PANE: VERIFICATION METADATA (40% Width)   |
|-------------------------------------------------|-------------------------------------------------|
| [High-Resolution Slip Image Preview]            | Tenant Information:                             |
| - Zoom In / Zoom Out controls                   |   Name: Royal Elegance Salon                    |
| - Rotate 90° button                             |   Owner: Ayesha Khan (+92 300 1234567)           |
| - Download original file                        |                                                 |
| - Pan & inspect bank reference stamp            | Subscription Target:                            |
|                                                 |   Plan: Growth Monthly (PKR 15,000)             |
|                                                 |   Current End: 10 Nov 2026                      |
|                                                 |   New End (If Approved): 10 Dec 2026 (+1 Mo)    |
|                                                 |                                                 |
|                                                 | Claimed Transaction Details:                    |
|                                                 |   Amount: PKR 15,000                            |
|                                                 |   Method: Bank Transfer (Meezan Bank)           |
|                                                 |   Ref / Cheque #: TX-9021948                    |
|                                                 |                                                 |
|                                                 | VERIFICATION ACTIONS:                           |
|                                                 | [✓ Approve Slip & Extend Subscription]          |
|                                                 | [✕ Reject Slip With Mandatory Reason]           |
+---------------------------------------------------------------------------------------------------+
```

### 8.5 SaaS Dynamic Plan & Quota Builder (`/plans`)

```
+---------------------------------------------------------------------------------------------------+
| Topbar: SaaS Plan Catalogue & Dynamic Entitlement Builder | [+ Create New SaaS Plan]              |
+---------------------------------------------------------------------------------------------------+
| ROW 1: ACTIVE PLAN CATALOGUE (Cards with Version Badges)                                          |
| +-------------------------+ +-------------------------+ +-------------------------+               |
| | STARTER (v1.0)          | | GROWTH (v2.1)           | | ENTERPRISE PRO (v1.0)   |               |
| | PKR 8,000 / mo          | | PKR 15,000 / mo         | | PKR 25,000 / mo         |               |
| | 1 Branch · 10 Staff     | | 3 Branches · 25 Staff   | | Unlimited · 100+ Staff  |               |
| | 6 Active Salons         | | 8 Active Salons         | | 2 Active Salons         |               |
| | [Edit Version]          | | [Edit Version]          | | [Edit Version]          |               |
| +-------------------------+ +-------------------------+ +-------------------------+               |
+---------------------------------------------------------------------------------------------------+
| ROW 2: DYNAMIC PLAN VERSION EDITOR (Immutable Strategy: Publishes Next Version Number)            |
|                                                                                                   |
| SECTION A: COMMERCIALS & BASE INFO                                                                |
| - Plan Name: "Growth Tier"                   - Code: "GROWTH" (Immutable Unique Key)              |
| - Monthly Rate: [ PKR 15,000 ]               - Annual Rate: [ PKR 150,000 ] (2 Mo Free Discount)  |
|                                                                                                   |
| SECTION B: SYSTEM QUOTAS & LIMITS                                                                 |
| - Max Branches: [  3  ] branches             - Max Staff Profiles: [  25  ] stylists              |
| - Max Hardware POS Devices: [  2  ] terminals                                                     |
|                                                                                                   |
| SECTION C: DYNAMIC MODULE ENTITLEMENT MATRIX (14 Granular Capabilities)                           |
| [✓] Point of Sale & Billing ('pos')          [✓] Service Catalogue ('services')                   |
| [✓] Bundled Packages ('packages')            [✓] Customer Directory & Khata ('clients')           |
| [✓] Appointments & Calendar ('appointments') [✓] Bridal & Event Bookings ('bookings')             |
| [✓] Cash Registers & Drawers ('cash')        [✓] Inventory & Purchasing ('inventory')             |
| [✓] Expense Management ('expenses')          [✓] Staff Shifts & Attendance ('attendance')         |
| [✓] Monthly Payroll Engine ('payroll')       [✓] Stylist Commission Ledger ('commission')         |
| [✓] Tip Pooling & Distribution ('tips')      [✓] Financial Reports & Audit ('reports')            |
|                                                                                                   |
| SECTION D: HARDWARE & ENTERPRISE ADD-ONS                                                           |
| [ ] Biometric Device Integration (ZKTeco)    [✓] Branded Custom SMS Marketing Reminders           |
|                                                                                                   |
| [Cancel Changes]                                  [Publish Plan Version (v2.2) →]                |
+---------------------------------------------------------------------------------------------------+
```

* **Version Editor (Immutable Strategy):** Does not destructively overwrite active plan contracts; increments `versionNumber` and marks previous versions historical.
* **Backend Runtime Effect:** When salon staff login, `req.tenantContext.allowedModules` validates against these 14 module keys. Any un-entitled route is blocked with HTTP 403 (`MODULE_NOT_ENTITLED`).

---

## 9. Accessibility Standards

The Platform Portal must strictly comply with WCAG 2.1 Level AA accessibility:

1. **Keyboard Navigation:** All interactive elements (sidebar icons, tabs, modal triggers, table row actions) must be reachable via `Tab` and executable via `Enter` or `Space`.
2. **Visible Focus Rings:** Every focused interactive element must render a high-visibility focus ring:
   ```css
   outline: 2px solid #9D2558;
   outline-offset: 2px;
   ```
   *(Source: `frontend/src/index.css:106-110`)*
3. **Radix UI Dialog & Menu Semantics:** Modal dialogs use `role="dialog"` with `aria-modal="true"`. Escape key dismisses modals and restores focus to the trigger.
4. **Color Contrast:** All body text (`#23151D`), headings (`#18191B`), and muted labels (`#78616C`) meet or exceed a 4.5:1 contrast ratio against the `#FAF8F9` and white frosted glass surfaces.
5. **Screen Reader Status:** Status changes (e.g. "Tenant Suspended", "Slip Approved") trigger live announcements via `aria-live="polite"`.

---

## 10. Verification Sources

* `frontend/src/index.css`: Color variables, typography, `.report-records` table styling, scrollbar design.
* `frontend/src/components/layout/Sidebar.tsx`: Dual-mode capsule dock and expanded glass sidebar.
* `frontend/src/components/layout/Header.tsx`: Glass topbar, breadcrumbs, search, notification alerts.
* `frontend/src/components/ui/card.tsx`: Specular reflection glass card elevation tokens.
* `frontend/src/components/ui/stat-card.tsx`: Velvet wine gradient cards and frosted KPI cards.
* `frontend/src/components/ui/badge.tsx`: Semantic status pill variants and dot indicators.
* `frontend/src/components/ui/button.tsx`: Primary, secondary, outline, and destructive button styles.
* `design.md`: Ultra-premium frosted glass aesthetic guidelines and ambient light orb mesh.


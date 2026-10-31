# Meerab Salon Management System — Design System & UI Specification (SalonOS)

**Document Version:** 2.0.0 (Production Release)  
**Roles & Authors:** Principal UI/UX Designer & Staff Frontend Engineer  
**Scope:** Design tokens, Glassmorphism blur stack, typography hierarchy, KPI card specifications, and upcoming module optimization blueprints.

---

## 1. Executive Aesthetic Vision & Engineering Architecture

The SalonOS design system is engineered around an **Ultra-Premium Borderless Frosted Glassmorphism** aesthetic. Designed specifically for high-end luxury beauty salons, medical aesthetics clinics, and multi-branch enterprises, the interface balances visual elegance with operational speed.

### 1.1 Core Design Pillars

1. **Depth Without Rigid Lines:** We reject harsh, opaque borders (`border-slate-300`, `border-[#F1DEE3]`). Card boundaries are defined by **soft specular light reflections** (`border border-white/80` or `border border-white/90`) paired with subtle inner lighting (`inset 0 1.5px 2px rgba(255,255,255,1)`).
2. **Deep Frosted Blur Layering:** Surfaces utilize hardware-accelerated backdrop blur (`backdrop-blur-2xl`, `backdrop-saturate-150`). When floating above warm ambient background lighting orbs, frosted surfaces produce an organic, tactile glass feel.
3. **Harmonious Velvet & Rose Palette:** High-impact velvet wine gradients for primary hero metrics (`#9D2558`, `#851C47`, `#550C2C`), paired with pure white frosted glass surfaces and the signature **Rose Velvet Berry** accent (`#B82E69`).
4. **Zero Layout Shift (CLS = 0):** All interactive elements, dropdowns, modal triggers, and calendar popovers are engineered with `modal={false}`, Radix scroll-lock neutralization, and `scrollbar-gutter: stable` to eliminate page jitter.

---

## 2. Color Palette & Design Tokens

### 2.1 Brand & Accent Colors

| Token Name | HEX Code | Tailwind Utility | UI Usage & Context |
| :--- | :--- | :--- | :--- |
| **Rose Velvet Berry (Primary)** | `#B82E69` | `bg-[#B82E69]`, `text-[#B82E69]` | Signature brand highlight, active navigation pills, primary CTAs, icon accents |
| **Rose Berry Hover** | `#A02358` | `hover:bg-[#A02358]` | Hover state for interactive primary buttons and action pills |
| **Velvet Deep Plum** | `#550C2C` | `to-[#550C2C]` | Deep dark gradient anchor for hero stat cards |
| **Blush Rose Tint (Surface)** | `#FDF2F5` | `bg-[#FDF2F5]`, `text-[#B82E69]` | Active filter pills, subtle badge backgrounds, interactive pill containers |
| **Page Canvas Background** | `#FAF8F9` | `bg-[#FAF8F9]` | Global body background; warm ivory pearl off-white |
| **Charcoal Dark Heading** | `#18191B` | `text-[#18191B]` | Primary headers (H1-H3), metric numbers, high-contrast typography |
| **Muted Slate Mauve** | `#78616C` | `text-[#78616C]` | Subtitles, helper text, timestamps, metric labels, inactive nav icons |
| **Light Mauve Subtle** | `#A38D98` | `text-[#A38D98]` | Group headers, disabled icons, micro descriptions |

### 2.2 Frosted Glass & Surface Elevation Tokens

| Token Name | CSS / Tailwind Properties | Visual Impact |
| :--- | :--- | :--- |
| **Frosted Glass Card (`glass`)** | `border border-white/90 bg-white/70 backdrop-blur-2xl backdrop-saturate-150 rounded-[24px]` | Standard dashboard widget surface with glowing frosted edge |
| **Frosted Glass Solid (`default`)** | `border border-white/80 bg-white/75 backdrop-blur-2xl backdrop-saturate-150 rounded-[24px]` | Container for high-density tables and modal overlays |
| **Frosted Glass Subtle (`subtle`)** | `border border-white/60 bg-[#FAF8F9]/80 backdrop-blur-xl rounded-2xl` | Secondary blocks, inner summary boxes, zebra rows |
| **Specular Inset Highlight** | `shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)]` | Carved glass effect; reflects light from top edge |
| **Interactive Hover Elevation** | `hover:shadow-[0_18px_45px_rgba(184,46,105,0.08)] hover:border-white hover:-translate-y-0.5` | Tactile lift on hover with smooth 300ms transition |

---

## 3. Ambient Lighting & Canvas Architecture

The frosted glass blur effect relies on ambient color gradients placed behind the transparent canvas in `AppShell.tsx`:

```
+-----------------------------------------------------------------------------------------+
| [Glow 1: -top-20 -left-20 (Rose)]            [Glow 2: top-[20%] -right-20 (Ivory)]     |
|  w-[600px] h-[600px] blur-[140px]             w-[650px] h-[650px] blur-[150px]          |
|                                                                                         |
|  +--------------------+  +-----------------------------------------------------------+  |
|  | Floating Glass     |  | Frosted Glass Header: Breadcrumbs | Date | Notifications  |  |
|  | Sidebar Pill Dock  |  +-----------------------------------------------------------+  |
|  | (w-[54px] capsule) |                                                              |  |
|  |                    |  +---------------------------------------------------------+  |  |
|  | [Logo Pill]        |  | Row 1: 4 Hero Velvet Stat Cards (Clients, Bookings, etc)|  |  |
|  | [Nav Capsule]      |  +---------------------------------------------------------+  |  |
|  | [Logout Dock]      |                                                              |  |
|  |                    |  +--------------------------------+  +---------------------+  |  |
|  |                    |  | Day Schedule Timeline (8 cols) |  | 5-Day Picker (4 col)|  |  |
|  |                    |  +--------------------------------+  +---------------------+  |  |
|  |                    |                                                              |  |
|  |                    |  +---------------------------------------------------------+  |  |
|  |                    |  | Row 3: 3 Pure White Frosted KPI Cards (Cash, Bank, Dues)|  |  |
|  |                    |  +---------------------------------------------------------+  |  |
|  +--------------------+                                                              |  |
|                                                                                         |
| [Glow 3: top-[55%] left-[20%] (Peach)]        [Glow 4: -bottom-24 right-[30%] (Blush)]  |
|  w-[550px] h-[550px] blur-[130px]              w-[700px] h-[500px] blur-[160px]          |
+-----------------------------------------------------------------------------------------+
```

### 3.1 Production Ambient Light Snippet (`AppShell.tsx`)
```tsx
{/* ── AMBIENT LUXURY BLUR GLOW LIGHTS (VISIBLE UNDER FROSTED SIDEBAR, HEADER & CARDS) ── */}
<div className="fixed -top-20 -left-20 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#FCE4EC]/65 via-[#F8BBD0]/35 to-transparent blur-[140px] pointer-events-none -z-0" />
<div className="fixed top-[20%] -right-20 w-[650px] h-[650px] rounded-full bg-gradient-to-bl from-[#FFF0F5]/80 via-[#F8D2DC]/45 to-transparent blur-[150px] pointer-events-none -z-0" />
<div className="fixed top-[55%] left-[20%] w-[550px] h-[550px] rounded-full bg-gradient-to-tr from-[#FCE8EC]/50 via-[#F4DDE5]/40 to-transparent blur-[130px] pointer-events-none -z-0" />
<div className="fixed -bottom-24 right-[30%] w-[700px] h-[500px] rounded-full bg-gradient-to-tr from-[#FAF0F3]/75 via-[#FCE4EC]/35 to-transparent blur-[160px] pointer-events-none -z-0" />
```

---

## 4. Typography & Font Hierarchy

### 4.1 Font Families
* **Primary Sans Font:** `Inter`, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif.
* **Monospace Font (Figures & Codes):** `ui-monospace`, `SFMono-Regular`, `Menlo`, `Monaco`, `Consolas`, monospace.

### 4.2 Typographic Hierarchy Table

| UI Element | Size | Weight | Tracking | Number Rendering | Full Tailwind Class Recipe |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Top Hero Metric** | `28px`–`32px` (`text-3xl`) | `font-extrabold` | `tracking-tight` | Monospace | `text-3xl font-extrabold tracking-tight font-mono text-white` |
| **Bottom KPI Metric** | `24px`–`30px` (`text-2xl sm:text-3xl`) | `font-extrabold` | `tracking-tight` | Monospace Tabular | `text-2xl sm:text-3xl font-extrabold text-[#18191B] font-mono tabular-nums tracking-tight` |
| **Section Header (H2)** | `20px`–`24px` (`text-xl sm:text-2xl`) | `font-bold` | `tracking-tight` | Standard | `text-xl sm:text-2xl font-bold tracking-tight text-[#18191B]` |
| **Card Title (H3)** | `14px`–`16px` (`text-base`) | `font-semibold` | `tracking-tight` | Standard | `text-base font-semibold text-[#18191B] tracking-tight` |
| **Metric Subtitle** | `11px`–`12px` (`text-xs`) | `font-medium` | Normal | Standard | `text-xs text-[#78616C] font-medium mt-1` |
| **Micro Badge / Tag** | `10px` | `font-bold` | `tracking-wider` | Uppercase | `text-[10px] font-bold uppercase tracking-wider` |
| **Interactive Action Link** | `12px` (`text-xs`) | `font-semibold` | Normal | Standard | `text-xs font-semibold text-[#B82E69] hover:underline flex items-center gap-1` |

---

## 5. Master Specification for All Dashboard Cards

### 5.1 Row 1: The 4 Hero Velvet Stat Cards

These 4 cards represent high-level operational pulse and use our signature velvet wine/plum gradient system with large SVG watermarks.

```
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
│ [Icon]          CLIENTS │  │ [Icon]         BOOKINGS │  │ [Icon]         SERVICES │  │ [Icon]      COLLECTIONS │
│                         │  │                         │  │                         │  │                         │
│ 1,248                   │  │ 42                      │  │ 186                     │  │ Rs. 248,500             │
│ Total Registered Clients│  │ Total Appointments Today│  │ Active Catalogue        │  │ Total Actual Collections│
│            [Watermark]  │  │            [Watermark]  │  │            [Watermark]  │  │            [Watermark]  │
└─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘
```

#### Shared Structural Rules for Hero Velvet Cards:
* **Container:** `relative overflow-hidden rounded-[24px] p-5 text-white border border-white/20 shadow-sm transition-all duration-300 hover:shadow-md group`
* **Corner Radius:** `rounded-[24px]` (Modern squircle)
* **Icon Capsule:** `w-9 h-9 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-2xs`
* **Badge:** `text-[10px] font-semibold uppercase tracking-wider text-white/90 bg-white/15 px-2 py-0.5 rounded-full border border-white/20`
* **Watermark SVGs:** Positioned at `-right-3 -bottom-3`, `w-32 h-32`, `opacity-15`, with `group-hover:scale-110` micro-animation.
* **Strict Rule:** **NO corner gradient shade overlays** (`absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-white/...` is strictly prohibited to prevent discolored patches).

#### Individual Card Definitions:
1. **Total Registered Clients:**
   - Gradient: `bg-gradient-to-br from-[#9D2558] via-[#851C47] to-[#6A1237]`
   - Icon: `<Users className="w-5 h-5" />`
   - Watermark: Client user silhouette SVG (`stroke="white" strokeWidth="1.5"`)
2. **Total Appointments / Bookings:**
   - Gradient: `bg-gradient-to-br from-[#B3396D] via-[#9B2A5A] to-[#801D48]`
   - Icon: `<Calendar className="w-5 h-5" />`
   - Watermark: Calendar sheet with checkmark SVG (`-rotate-6 group-hover:rotate-0`)
3. **Active Catalogue Services:**
   - Gradient: `bg-gradient-to-br from-[#7E1A47] via-[#6B133A] to-[#550C2C]`
   - Icon: `<Scissors className="w-5 h-5" />`
   - Watermark: Stylized salon shears SVG (`rotate-45 group-hover:rotate-12`)
4. **Daily Actual Collections:**
   - Gradient: `bg-gradient-to-br from-[#A84B68] via-[#8F3B54] to-[#752B41]`
   - Icon: `<Wallet className="w-5 h-5" />`
   - Watermark: Currency banknote and coin SVG (`-rotate-12 group-hover:rotate-0`)

---

### 5.2 Row 2: Operational Agenda Cards

#### 1. Day Schedule Timeline Card (8 Columns)
* **Surface:** `<Card variant="glass" padding="none" className="p-6 overflow-hidden relative group rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white">`
* **Stylist Filter Selector:** Borderless pill pills with `#B82E69` active state (`bg-[#B82E69] text-white shadow-2xs font-bold`) and subtle inactive state (`bg-white/70 text-[#78616C] shadow-2xs hover:bg-[#FDF2F5]`).
* **Appointment Matrix Items:** `p-3 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/80 hover:bg-white shadow-[0_2px_12px_rgba(35,21,29,0.025)] hover:shadow-[0_4px_18px_rgba(184,46,105,0.08)] transition-all cursor-pointer`.
* **Available Slot Placeholder:** `h-8 rounded-xl border border-white/60 flex items-center justify-between px-3 text-[11px] text-[#A38D98] bg-white/50 backdrop-blur-sm shadow-2xs`.

#### 2. 5-Day Booking Calendar Card (4 Columns)
* **Surface:** Same `<Card variant="glass">` specs as Day Schedule.
* **Mode Toggle (Bookings vs Appointments):** `bg-[#FDF2F5] border-0 shadow-inner p-1 rounded-xl` with active white pill (`bg-white text-[#B82E69] shadow-2xs`).
* **5-Day Calendar Strip:** `p-1.5 rounded-2xl bg-[#FDF2F5] border-0 shadow-inner grid grid-cols-5 gap-1 text-center`. Active date uses `bg-white text-[#B82E69] shadow-xs font-bold`.
* **List Items:** Frosted cards `border border-white/80 bg-white/80 backdrop-blur-xl hover:bg-white`.

---

### 5.3 Row 3: Pure White Frosted Blur Financial KPI Cards

> [!IMPORTANT]
> **MINIMALIST LUXURY RULE:** These cards must **NEVER** use conflicting multi-colored glow orbs, wavy SVG lines, or background watermark icons. They must remain exceptionally clean, pure **white frosted glass** (`bg-white/75 backdrop-blur-2xl`) with crisp typography and subtle micro-shadows.

```
┌─────────────────────────────────┐  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│ [Icon] Counter Cash Drawer      │  │ [Icon] Bank & Digital Accounts  │  │ [Icon] Outstanding Receivables  │
│ [Active Till Pill]              │  │ [Count Badge]                   │  │ [Pending Pill]                  │
│                                 │  │                                 │  │                                 │
│ Rs. 45,200                      │  │ Rs. 203,300                     │  │ Rs. 18,500                      │
│ Collected today: Rs. 45,200     │  │ Digital received: Rs. 142,000   │  │ Total discounts: Rs. 4,200      │
│ Transfer & Settle Cash →        │  │ Account Statements →            │  │ Inspect Invoices & Inflows →    │
└─────────────────────────────────┘  └─────────────────────────────────┘  └─────────────────────────────────┘
```

#### Shared Surface Specification:
```tsx
<Card
  variant="glass"
  padding="none"
  className="p-5 sm:p-6 space-y-2 relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 group rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)] hover:border-white"
>
```

#### 1. Counter Cash Drawer
* **Icon:** `<Wallet className="w-4 h-4 text-[#B82E69]" />` in `w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80`.
* **Status Pill:** `bg-[#FDF2F5] text-[#B82E69] shadow-2xs border border-white/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full`.
* **Background:** Clean frosted glass (strictly NO background lines or clutter).
* **Metric Value:** `text-2xl sm:text-3xl font-extrabold text-[#18191B] font-mono tabular-nums tracking-tight`.
* **Subtitle Row:** `text-xs text-[#78616C]` + `font-semibold text-slate-800 font-mono`.
* **Action:** `text-xs font-semibold text-[#B82E69] hover:underline flex items-center gap-1`.

#### 2. Bank & Digital Accounts
* **Icon:** `<Landmark className="w-4 h-4 text-[#B82E69]" />` in `w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80`.
* **Count Badge:** `bg-[#FAF8F9] text-[#78616C] shadow-2xs border border-white/60 text-[11px] font-semibold px-2 py-0.5 rounded-full`.
* **Background:** Clean frosted glass (strictly NO background lines or clutter).
* **Metric Value:** `text-2xl sm:text-3xl font-extrabold text-[#18191B] font-mono tabular-nums tracking-tight`.
* **Subtitle Row:** `text-xs text-[#78616C]` + `font-semibold text-slate-800 font-mono`.
* **Action:** `text-xs font-semibold text-[#B82E69] hover:underline flex items-center gap-1`.

#### 3. Outstanding Receivables
* **Icon:** `<Receipt className="w-4 h-4 text-[#B82E69]" />` in `w-8 h-8 rounded-xl bg-white/90 shadow-2xs border border-white/80`.
* **Status Pill:** `bg-[#FDF2F5] text-[#B82E69] shadow-2xs border border-white/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full` ("Pending").
* **Background:** Clean frosted glass (strictly NO background lines or clutter).
* **Metric Value:** `text-2xl sm:text-3xl font-extrabold text-[#18191B] font-mono tabular-nums tracking-tight`.
* **Subtitle Row:** `text-xs text-[#78616C]` + `font-semibold text-slate-800 font-mono`.
* **Action:** `text-xs font-semibold text-[#B82E69] hover:underline flex items-center gap-1`.

---

### 5.4 Staff Attendance & Queue Cards (`AdminDashboard.tsx`)
* **Surface:** Same `<Card variant="glass">` specs (`rounded-[24px] border border-white/90 bg-white/75`).
* **Staff Duty Tile:** `p-3.5 rounded-2xl border-0 bg-white/80 backdrop-blur-xl hover:bg-white flex items-center justify-between shadow-[0_4px_16px_rgba(35,21,29,0.025)] transition-all`.
* **Avatar Badge:** `w-8 h-8 rounded-full bg-[#FDF2F5] text-[#B82E69] font-bold text-xs shadow-2xs`.
* **Status Badge:** `bg-emerald-50/80 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border-0`.

---

### 5.5 Enterprise Multi-Branch Matrix (`SuperAdminDashboard.tsx`)
* **Surface:** `<Card variant="glass" padding="none" className="overflow-hidden rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(35,21,29,0.035),inset_0_1.5px_2px_rgba(255,255,255,1)]">`
* **Table Header (`thead`):** `bg-[#FAF8F9]/80 text-slate-700 font-semibold border-0 py-3.5 px-5`.
* **Table Rows (`tr`):** `hover:bg-white/70 transition-colors border-0`.
* **Financial Numerals:** All cells use `font-mono tabular-nums font-medium text-slate-900`.

---

## 6. Frontend Engineering Rules & Anti-Jitter Architecture

### 6.1 Layout Anti-Jitter Rules (Zero Cumulative Layout Shift)
In Windows browsers, Radix UI dropdowns and select modals inject inline `margin-right: 17px` onto `body` and lock scrolling, causing noticeable screen jumping.
* **Radix Dropdowns:** Always pass `modal={false}` to `<DropdownMenu modal={false}>`.
* **Auto-Focus Prevention:** Always add `onCloseAutoFocus={(e) => e.preventDefault()}` on `<DropdownMenuContent>`.
* **CSS Lock Neutralization (`index.css`):**
```css
html {
  overflow-y: scroll;
  scrollbar-gutter: stable;
}

body[data-scroll-locked],
html[data-scroll-locked] {
  margin-right: 0px !important;
  padding-right: 0px !important;
  overflow-y: scroll !important;
}
```

### 6.2 Data Integrity Rules (Crucial for AI & Pair Programmers)
* **Never Hardcode Mock Data:** UI optimization must only touch styling, tokens, and CSS classes. Never replace live endpoints or state arrays (`data.metrics`, `data.cashDrawers`, etc.) with hardcoded objects.
* **Keep Tabular Numbers:** Always use `font-mono tabular-nums` for financial numbers to prevent width jumping when values change dynamically.

---

## 7. Upcoming Module UI Optimization Blueprint

With the dashboard design system finalized, all upcoming software modules must adhere to these exact component templates:

### Module Checklist for Upcoming Optimization:
1. **POS Billing Terminal (`/pos`)**:
   - Cart panel & summary to use `bg-white/80 backdrop-blur-2xl rounded-[24px] border border-white/90`.
   - Keypad buttons to use `rounded-2xl border border-white/80 shadow-2xs font-mono font-bold`.
2. **Appointments & Bookings (`/operations/appointments`)**:
   - Appointment cards to inherit `rounded-2xl border border-white/80 bg-white/80 backdrop-blur-xl`.
   - Date picker to use the frosted capsule pill dock.
3. **Clients CRM (`/operations/clients`)**:
   - Client history records table to use borderless glass table structure (`SuperAdminDashboard` matrix pattern).
4. **Services Catalogue (`/admin/services`)**:
   - Service cards to use `variant="glass"` with category badge pills (`bg-[#FDF2F5] text-[#B82E69]`).
5. **Accounts & Reports (`/reports/income-expense`, `/reports/debit-credit`)**:
   - Ledger summary cards to use Row 3 White Frosted KPI cards with monospace currency figures.

---
*End of Design System & UI Specification v2.0.0*

# Household Chores PWA

An offline-first, static-hosted Progressive Web App (PWA) for managing repeating household chores, powered by a pragmatic day-at-a-time scheduling algorithm.

---

## Features

- **Day-at-a-Time Focus**: No complex calendar planning or overwhelming future schedules. The app calculates and presents a manageable quota for today.
- **Smart Prioritization**: Balances high-frequency tasks (daily/weekly) with long-term chores (monthly/quarterly/yearly) using relative urgency ratios.
- **Workload Smoothing ("No Frontloading")**: Distributes the week's tasks evenly across active days so work doesn't pile up on Monday.
- **Configurable Active Days**: Choose which weekdays are active chore days and which serve as rest and catch-up buffers (e.g. weekends).
- **Cold-Start Staggering**: Automatically staggers chores when first added, preventing a wall of 15 overdue tasks on day 1.
- **3-Screen Alpine.js SPA**:
  - **Today (`#today`)**: Focus checklist for today's quota, overdue backlog, and a collapsible accordion of upcoming chores.
  - **Settings (`#settings`)**: Full chore management (CRUD), active weekday configuration, and JSON backup/restore.
  - **Add/Edit Form (`#add`, `#edit/:id`)**: Form for configuring chore name, interval (`day`, `week`, `month`), preferred weekdays, and optional last completed date.
- **Offline-First PWA**: Service Worker pre-caching with offline fallback and standalone installation support.
- **Local Persistence**: Stores everything in `localStorage` with easy JSON export/import.

---

## Scheduling Algorithm Principles

### 1. Relative Urgency Ratio ($\rho$)

$$\rho = \frac{\text{Days elapsed since last performed}}{\text{Interval duration in days}}$$

- **$\rho < 1.0$**: Not yet due.
- **$\rho = 1.0$**: Due today.
- **$\rho > 1.0$**: Overdue.

A neglected daily task (7 days overdue $\implies \rho = 8.0$) strictly takes priority over a weekly task (1 week overdue $\implies \rho = 2.0$) and a yearly chore (1 month overdue $\implies \rho \approx 1.08$).

### 2. Daily Quota Distribution

$$\text{Daily Quota} = \left\lceil \frac{N_{\text{due this week}}}{D_{\text{remaining active days this week}}} \right\rceil$$

- **4 tasks due across 4 active days (Mon–Thu)**: Yields 1 task/day Mon–Thu, leaving Fri–Sun buffer for rest/catch-up.
- **8 tasks due across 7 active days**: Yields 2 tasks on Monday, and 1 task/day Tue–Sun.
- **Adaptive catch-up**: If days are skipped, the remaining active days divisor dynamically recalculates the quota without dropping tasks.

### 3. Weekday Affinity & Deferrals

- Chores tied to specific weekdays (e.g. `['saturday']`) are deferred until that day unless severely overdue ($\rho \ge 1.3$).
- On matching preferred days, chores receive a priority boost ($\rho + 0.5$) to ensure they get scheduled on that day.

### 4. Deterministic Cold-Start Staggering

When `lastPerformed` is not set, chores are deterministically staggered across their cycle ($[0.05, 0.85] \times \text{interval}$) using a hash of the chore name/ID.

---

## Project Structure

```
├── dist/                 # Production-ready static PWA build
├── scripts/
│   └── build.mjs         # esbuild JS/CSS bundler & template compiler
├── src/
│   ├── app.js            # Alpine.js reactive store & controller
│   ├── index.html        # HTML layout shell
│   ├── index.ts          # Public TypeScript exports
│   ├── planner.ts        # Pure-function scheduling algorithm
│   ├── styles.css        # Marx-css extension & component styles
│   ├── sw.js             # Offline Service Worker
│   ├── manifest.json     # PWA Manifest
│   ├── icon.svg          # App icon
│   ├── templates/        # HTML partials (today, settings, form, toast)
│   └── types.ts          # TypeScript interfaces & types
├── tests/
│   └── planner.test.ts   # Test suite (Node.js test runner)
└── vendor/
    └── marx-css/         # Classless CSS foundation
```

---

## Getting Started

### Prerequisites

- Node.js 20+ / 22+
- pnpm (or npm)

### Installation

```bash
pnpm install
```

### Development & Build Commands

- **Build**: Bundle JavaScript, CSS, templates, and static assets to `dist/`:
  ```bash
  pnpm run build
  ```
- **Test**: Run unit test suite using Node's built-in test runner:
  ```bash
  pnpm test
  ```
- **Lint**: Run ESLint across JS, CSS, and Markdown:
  ```bash
  pnpm run lint
  ```
- **Format**: Format codebase with Prettier:
  ```bash
  pnpm run format
  ```

---

## License

MIT

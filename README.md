# Chores Planner Algorithm

A pragmatic, offline-first chore scheduling algorithm designed for PWAs and local-first applications.

## Key Principles

1. **Relative Urgency Ratio ($\rho$)**:
   $$\rho = \frac{\text{Days elapsed since last performed}}{\text{Interval duration in days}}$$
   - $\rho < 1.0$: Upcoming / not yet due.
   - $\rho \ge 1.0$: Due or overdue.
   - Ensures frequent habits that are neglected (e.g. daily task 7 days overdue $\implies \rho = 8.0$) strictly take priority over less frequent tasks (e.g. weekly task 1 week overdue $\implies \rho = 2.0$, or yearly task 1 month overdue $\implies \rho \approx 1.08$).

2. **Workload Smoothing ("No Frontloading")**:
   $$\text{Daily Quota} = \left\lceil \frac{N_{\text{due this week}}}{D_{\text{remaining active days this week}}} \right\rceil$$
   - 4 tasks due across Mon–Thu $\implies 1$ task/day Mon–Thu, leaving Fri–Sun as buffer.
   - 8 tasks due across 7 active days $\implies 2$ tasks on Monday, $1$ task/day Tue–Sun.
   - If tasks are skipped earlier in the week, quota adapts smoothly without dropping tasks.

3. **Weekday Preferences**:
   - Chores preferring a specific weekday (e.g. `['saturday']`) are deferred until that day unless severely overdue ($\rho \ge 1.3$).
   - On the preferred day, they receive an affinity priority boost ($\rho + 0.5$).

4. **Deterministic Cold-Start Staggering**:
   - When `lastPerformed` is `undefined`, chores are deterministically staggered across their cycle using a hash of the chore name/id. Users are never greeted with a wall of 15 overdue tasks on day 1.

## Usage

```typescript
import { planDay, Chore } from 'chores-planner';

const chores: Chore[] = [
  { name: 'Wasmachine/droger/vaatwasser', interval: { type: 'month', amount: 1 } },
  { name: 'Beddengoed', interval: { type: 'week', amount: 2 } },
  { name: 'Planten', interval: { type: 'week', amount: 1, weekdays: ['saturday'] } },
  { name: 'Gordijnen', interval: { type: 'month', amount: 12 } },
];

const plan = planDay(chores, {
  today: new Date(),
  activeWeekdays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
});

console.log('Tasks for Today:', plan.todayTasks);
console.log('Backlog:', plan.backlogTasks);
console.log('Upcoming:', plan.upcomingTasks);
console.log('Metrics:', plan.metrics);
```

## Running Tests

```bash
npm run build
npm test
```

import {
  Chore,
  ChoreInterval,
  DailyPlan,
  DailyPlanMetrics,
  PlanOptions,
  PlannedChore,
  Weekday,
} from './types.js';

export const AVERAGE_DAYS_IN_MONTH = 30.4375;

export const DEFAULT_ACTIVE_WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];

const WEEKDAYS: Weekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/**
 * Normalizes a Date to midnight (00:00:00.000) local time.
 */
export function normalizeDate(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Gets the lowercase weekday name for a date.
 */
export function getWeekday(date: Date): Weekday {
  return WEEKDAYS[date.getDay()];
}

/**
 * Calculates the interval duration in fractional days.
 */
export function getIntervalInDays(interval: ChoreInterval): number {
  const amount = Math.max(0.1, interval.amount || 1);
  switch (interval.type) {
    case 'day':
      return amount;
    case 'week':
      return amount * 7;
    case 'month':
      return amount * AVERAGE_DAYS_IN_MONTH;
    default:
      return amount;
  }
}

/**
 * 32-bit djb2 string hash for deterministic cold-start staggering.
 */
export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Computes the whole or fractional days between two dates (to - from).
 */
export function daysBetween(from: Date, to: Date): number {
  const ms = normalizeDate(to).getTime() - normalizeDate(from).getTime();
  return Math.max(0, ms / (24 * 60 * 60 * 1000));
}

/**
 * Determines the effective lastPerformed date.
 * If undefined/null, generates a deterministic past date so chores are staggered.
 */
export function getEffectiveLastPerformed(
  chore: Chore,
  intervalInDays: number,
  today: Date
): Date {
  if (chore.lastPerformed) {
    const parsed =
      typeof chore.lastPerformed === 'string'
        ? new Date(chore.lastPerformed)
        : chore.lastPerformed;
    if (!isNaN(parsed.getTime())) {
      return normalizeDate(parsed);
    }
  }

  // Cold-start staggering: distribute initial offset across [0.05, 0.85] of the interval
  // We use integer days so daysSinceLastPerformed < intervalInDays on initial cold start
  const seed = chore.id || chore.name;
  const hash = hashString(seed);
  const ratio = 0.05 + ((hash % 800) / 1000); // 0.05 to 0.849
  const elapsedDays = Math.max(0, Math.floor(ratio * intervalInDays));
  const syntheticDate = new Date(today.getTime());
  syntheticDate.setDate(syntheticDate.getDate() - elapsedDays);
  return normalizeDate(syntheticDate);
}

/**
 * Counts how many active weekdays remain in the current ISO week (from today through Sunday).
 */
export function getRemainingActiveDaysThisWeek(
  today: Date,
  activeWeekdays: Set<Weekday>
): number {
  const currentIsoDay = (today.getDay() + 6) % 7; // Mon=0 ... Sun=6
  let count = 0;
  for (let offset = 0; offset <= (6 - currentIsoDay); offset++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() + offset);
    if (activeWeekdays.has(getWeekday(checkDate))) {
      count++;
    }
  }
  return count;
}

/**
 * Plans chores for a specific day.
 */
export function planDay(chores: Chore[], options?: PlanOptions): DailyPlan {
  const today = normalizeDate(options?.today ?? new Date());
  const todayWeekday = getWeekday(today);
  const activeWeekdaysList = options?.activeWeekdays ?? DEFAULT_ACTIVE_WEEKDAYS;
  const activeWeekdays = new Set<Weekday>(activeWeekdaysList);
  const isRestDay = !activeWeekdays.has(todayWeekday);

  const isoDay = (today.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const daysToEndOfWeek = 6 - isoDay;
  const remainingActiveDays = getRemainingActiveDaysThisWeek(today, activeWeekdays);

  // Evaluate each chore
  const evaluated: PlannedChore[] = chores.map((chore) => {
    const intervalInDays = getIntervalInDays(chore.interval);
    const effectiveLastPerformed = getEffectiveLastPerformed(chore, intervalInDays, today);
    const daysSinceLastPerformed = daysBetween(effectiveLastPerformed, today);
    const urgencyRatio = daysSinceLastPerformed / intervalInDays;

    const preferredWeekdays = chore.interval.weekdays;
    const hasPreferred = Array.isArray(preferredWeekdays) && preferredWeekdays.length > 0;
    const preferredWeekdayMatch = hasPreferred ? preferredWeekdays.includes(todayWeekday) : false;

    let deferredDueToWeekday = false;
    let score = urgencyRatio;

    if (hasPreferred) {
      if (preferredWeekdayMatch) {
        // Boost priority on its preferred day if due or approaching due
        if (urgencyRatio >= 0.75) {
          score = urgencyRatio + 0.5;
        }
      } else {
        // On non-preferred days, defer unless severely overdue (>= 1.3x interval)
        if (urgencyRatio < 1.3) {
          deferredDueToWeekday = true;
        }
      }
    }

    const daysUntilDue = intervalInDays - daysSinceLastPerformed;
    const isOverdue = urgencyRatio >= 1.0;
    const isDueThisWeek = isOverdue || daysUntilDue <= daysToEndOfWeek;

    return {
      chore,
      intervalInDays,
      effectiveLastPerformed,
      daysSinceLastPerformed,
      urgencyRatio,
      score,
      isOverdue,
      isDueThisWeek,
      preferredWeekdayMatch,
      deferredDueToWeekday,
    };
  });

  // Calculate workload due this week (excluding those deferred to a future preferred weekday if overdue)
  const totalDueThisWeek = evaluated.filter((c) => c.isDueThisWeek).length;

  // Calculate today's quota
  let quotaForToday = 0;
  if (!isRestDay && remainingActiveDays > 0) {
    quotaForToday = Math.ceil(totalDueThisWeek / remainingActiveDays);
  }

  // Eligible candidates for today's quota
  const eligibleToday = evaluated
    .filter((c) => !c.deferredDueToWeekday && c.isDueThisWeek)
    .sort((a, b) => {
      // Sort by score descending (primary)
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Sort by urgency ratio descending (secondary)
      if (b.urgencyRatio !== a.urgencyRatio) {
        return b.urgencyRatio - a.urgencyRatio;
      }
      // Deterministic tie-breaker
      return a.chore.name.localeCompare(b.chore.name);
    });

  let todayTasks: PlannedChore[] = [];
  let backlogTasks: PlannedChore[] = [];
  let upcomingTasks: PlannedChore[] = [];

  if (isRestDay) {
    todayTasks = [];
    backlogTasks = evaluated
      .filter((c) => c.isOverdue)
      .sort((a, b) => b.score - a.score);
    upcomingTasks = evaluated
      .filter((c) => !c.isOverdue)
      .sort((a, b) => a.intervalInDays - b.intervalInDays);
  } else {
    todayTasks = eligibleToday.slice(0, quotaForToday);
    const todayIds = new Set(todayTasks.map((t) => t.chore.name));

    backlogTasks = evaluated
      .filter((c) => !todayIds.has(c.chore.name) && c.isOverdue)
      .sort((a, b) => b.score - a.score);

    const backlogIds = new Set(backlogTasks.map((t) => t.chore.name));

    upcomingTasks = evaluated
      .filter((c) => !todayIds.has(c.chore.name) && !backlogIds.has(c.chore.name))
      .sort((a, b) => b.urgencyRatio - a.urgencyRatio);
  }

  const metrics: DailyPlanMetrics = {
    quotaForToday,
    totalDueThisWeek,
    remainingActiveDaysThisWeek: remainingActiveDays,
    isRestDay,
  };

  return {
    date: today,
    todayTasks,
    backlogTasks,
    upcomingTasks,
    metrics,
  };
}

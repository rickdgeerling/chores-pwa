export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type IntervalType = "day" | "week" | "month";

export interface ChoreInterval {
  type: IntervalType;
  amount: number;
  weekdays?: Weekday[];
}

export interface Chore {
  id?: string;
  name: string;
  interval: ChoreInterval;
  lastPerformed?: Date | string | null;
}

export interface PlannedChore {
  chore: Chore;
  intervalInDays: number;
  effectiveLastPerformed: Date;
  daysSinceLastPerformed: number;
  urgencyRatio: number;
  score: number;
  isOverdue: boolean;
  isDueThisWeek: boolean;
  preferredWeekdayMatch: boolean;
  deferredDueToWeekday: boolean;
}

export interface PlanOptions {
  today?: Date | string;
  activeWeekdays?: Weekday[];
}

export interface DailyPlanMetrics {
  quotaForToday: number;
  totalDueThisWeek: number;
  remainingActiveDaysThisWeek: number;
  isRestDay: boolean;
}

export interface DailyPlan {
  date: Date;
  todayTasks: PlannedChore[];
  backlogTasks: PlannedChore[];
  upcomingTasks: PlannedChore[];
  metrics: DailyPlanMetrics;
}

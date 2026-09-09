import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  planDay,
  getIntervalInDays,
  getWeekday,
  getEffectiveLastPerformed,
} from '../src/planner.js';
import { Chore, Weekday } from '../src/types.js';

describe('Chore Planner Algorithm', () => {
  describe('Interval & Date Utilities', () => {
    it('calculates interval durations correctly', () => {
      assert.strictEqual(getIntervalInDays({ type: 'day', amount: 1 }), 1);
      assert.strictEqual(getIntervalInDays({ type: 'day', amount: 3 }), 3);
      assert.strictEqual(getIntervalInDays({ type: 'week', amount: 1 }), 7);
      assert.strictEqual(getIntervalInDays({ type: 'week', amount: 2 }), 14);
      assert.strictEqual(getIntervalInDays({ type: 'month', amount: 1 }), 30.4375);
      assert.strictEqual(getIntervalInDays({ type: 'month', amount: 3 }), 91.3125); // kwartaal
      assert.strictEqual(getIntervalInDays({ type: 'month', amount: 12 }), 365.25); // jaarlijks
    });

    it('identifies weekdays correctly', () => {
      // 2025-01-06 is Monday
      assert.strictEqual(getWeekday(new Date('2025-01-06T12:00:00Z')), 'monday');
      assert.strictEqual(getWeekday(new Date('2025-01-07T12:00:00Z')), 'tuesday');
      assert.strictEqual(getWeekday(new Date('2025-01-11T12:00:00Z')), 'saturday');
      assert.strictEqual(getWeekday(new Date('2025-01-12T12:00:00Z')), 'sunday');
    });
  });

  describe('Rule of Thumb 1: Workload distribution over 4 active days (Mon-Thu)', () => {
    it('plans 1 task per day from Monday through Thursday when 4 tasks are due', () => {
      const activeWeekdays: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday'];
      const monday = new Date('2025-01-06T10:00:00'); // Monday

      // 4 weekly chores that were all performed 7 days ago (all due today)
      const chores: Chore[] = [
        { name: 'Task 1', interval: { type: 'week', amount: 1 }, lastPerformed: new Date('2024-12-30T10:00:00') },
        { name: 'Task 2', interval: { type: 'week', amount: 1 }, lastPerformed: new Date('2024-12-30T10:00:00') },
        { name: 'Task 3', interval: { type: 'week', amount: 1 }, lastPerformed: new Date('2024-12-30T10:00:00') },
        { name: 'Task 4', interval: { type: 'week', amount: 1 }, lastPerformed: new Date('2024-12-30T10:00:00') },
      ];

      // Monday: 4 due / 4 active days remaining = quota 1
      const planMonday = planDay(chores, { today: monday, activeWeekdays });
      assert.strictEqual(planMonday.metrics.totalDueThisWeek, 4);
      assert.strictEqual(planMonday.metrics.remainingActiveDaysThisWeek, 4);
      assert.strictEqual(planMonday.metrics.quotaForToday, 1);
      assert.strictEqual(planMonday.todayTasks.length, 1);
      assert.strictEqual(planMonday.backlogTasks.length, 3);

      // Suppose Task 1 was completed on Monday. On Tuesday:
      const tuesday = new Date('2025-01-07T10:00:00');
      chores[0].lastPerformed = monday; // Task 1 done
      const planTuesday = planDay(chores, { today: tuesday, activeWeekdays });
      assert.strictEqual(planTuesday.metrics.totalDueThisWeek, 3);
      assert.strictEqual(planTuesday.metrics.remainingActiveDaysThisWeek, 3);
      assert.strictEqual(planTuesday.metrics.quotaForToday, 1);
      assert.strictEqual(planTuesday.todayTasks.length, 1);

      // Suppose Task 2 completed on Tuesday. On Wednesday:
      const wednesday = new Date('2025-01-08T10:00:00');
      chores[1].lastPerformed = tuesday;
      const planWednesday = planDay(chores, { today: wednesday, activeWeekdays });
      assert.strictEqual(planWednesday.metrics.quotaForToday, 1);

      // Suppose Task 3 completed on Wednesday. On Thursday:
      const thursday = new Date('2025-01-09T10:00:00');
      chores[2].lastPerformed = wednesday;
      const planThursday = planDay(chores, { today: thursday, activeWeekdays });
      assert.strictEqual(planThursday.metrics.quotaForToday, 1);

      // Suppose Task 4 completed on Thursday. On Friday (rest day):
      const friday = new Date('2025-01-10T10:00:00');
      chores[3].lastPerformed = thursday;
      const planFriday = planDay(chores, { today: friday, activeWeekdays });
      assert.strictEqual(planFriday.metrics.isRestDay, true);
      assert.strictEqual(planFriday.metrics.quotaForToday, 0);
      assert.strictEqual(planFriday.todayTasks.length, 0);
    });
  });

  describe('Rule of Thumb 2: 8 tasks due across 7 active days (Mon-Sun)', () => {
    it('plans 2 tasks on Monday, and 1 per day for the remaining week days', () => {
      const activeWeekdays: Weekday[] = [
        'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
      ];
      const monday = new Date('2025-01-06T10:00:00'); // Monday

      const chores: Chore[] = Array.from({ length: 8 }, (_, i) => ({
        name: `Task ${i + 1}`,
        interval: { type: 'week', amount: 1 },
        lastPerformed: new Date('2024-12-30T10:00:00'), // 7 days ago -> due today
      }));

      // Monday: 8 tasks / 7 days remaining = ceil(8/7) = 2
      const planMonday = planDay(chores, { today: monday, activeWeekdays });
      assert.strictEqual(planMonday.metrics.totalDueThisWeek, 8);
      assert.strictEqual(planMonday.metrics.remainingActiveDaysThisWeek, 7);
      assert.strictEqual(planMonday.metrics.quotaForToday, 2);
      assert.strictEqual(planMonday.todayTasks.length, 2);

      // Complete 2 tasks on Monday. Tuesday has 6 tasks / 6 days = ceil(6/6) = 1
      const tuesday = new Date('2025-01-07T10:00:00');
      chores[0].lastPerformed = monday;
      chores[1].lastPerformed = monday;
      const planTuesday = planDay(chores, { today: tuesday, activeWeekdays });
      assert.strictEqual(planTuesday.metrics.totalDueThisWeek, 6);
      assert.strictEqual(planTuesday.metrics.remainingActiveDaysThisWeek, 6);
      assert.strictEqual(planTuesday.metrics.quotaForToday, 1);
      assert.strictEqual(planTuesday.todayTasks.length, 1);
    });
  });

  describe('Rule of Thumb 3: Relative Urgency Ratio prioritization', () => {
    it('prioritizes a daily task 7 days overdue over a weekly task 1 week overdue', () => {
      const today = new Date('2025-01-08T10:00:00'); // Wednesday

      const dailyTask: Chore = {
        name: 'Daily Dishwasher Rinse',
        interval: { type: 'day', amount: 1 },
        // Last performed 8 days ago -> 7 days overdue -> urgency ratio = 8.0
        lastPerformed: new Date('2024-12-31T10:00:00'),
      };

      const weeklyTask: Chore = {
        name: 'Weekly Floor Mopping',
        interval: { type: 'week', amount: 1 },
        // Last performed 14 days ago -> 7 days (1 week) overdue -> urgency ratio = 2.0
        lastPerformed: new Date('2024-12-25T10:00:00'),
      };

      const monthlyTask: Chore = {
        name: 'Monthly Filter Cleaning',
        interval: { type: 'month', amount: 1 },
        // Last performed 38 days ago -> ~8 days overdue -> urgency ratio ~ 1.25
        lastPerformed: new Date('2024-12-01T10:00:00'),
      };

      const plan = planDay([monthlyTask, weeklyTask, dailyTask], {
        today,
        activeWeekdays: ['wednesday'],
      });

      assert.strictEqual(plan.todayTasks.length >= 1, true);
      // The daily task must rank #1
      assert.strictEqual(plan.todayTasks[0].chore.name, 'Daily Dishwasher Rinse');
      assert.strictEqual(plan.todayTasks[0].urgencyRatio, 8);
    });
  });

  describe('Cold Start Staggering (undefined lastPerformed)', () => {
    it('deterministically distributes chores with undefined lastPerformed across their cycle', () => {
      const today = new Date('2025-01-06T10:00:00');
      const choreA: Chore = { name: 'Planten water geven', interval: { type: 'week', amount: 1 } };
      const choreB: Chore = { name: 'Beddengoed wassen', interval: { type: 'week', amount: 2 } };

      const syntheticA1 = getEffectiveLastPerformed(choreA, 7, today);
      const syntheticA2 = getEffectiveLastPerformed(choreA, 7, today);
      // Deterministic
      assert.strictEqual(syntheticA1.getTime(), syntheticA2.getTime());

      // Should be in past, but not overdue (less than interval duration)
      const daysAgoA = (today.getTime() - syntheticA1.getTime()) / (24 * 60 * 60 * 1000);
      assert.ok(daysAgoA >= 0 && daysAgoA < 7);

      // On day 1 of cold start, plan creates a gentle distributed quota
      const plan = planDay([choreA, choreB], { today });
      assert.ok(plan.metrics.quotaForToday <= 1);
      assert.strictEqual(plan.todayTasks.length + plan.upcomingTasks.length, 2);
    });
  });

  describe('Weekday Preferences', () => {
    it('defers non-urgent chores if today is not their preferred weekday', () => {
      // Monday
      const monday = new Date('2025-01-06T10:00:00');

      const saturdayChore: Chore = {
        name: 'Zaterdag Schoonmaak',
        interval: { type: 'week', amount: 1, weekdays: ['saturday'] },
        // 7 days ago (ratio = 1.0, due this week on Saturday)
        lastPerformed: new Date('2024-12-30T10:00:00'),
      };

      const regularChore: Chore = {
        name: 'Reguliere Taak',
        interval: { type: 'week', amount: 1 },
        lastPerformed: new Date('2024-12-30T10:00:00'),
      };

      const plan = planDay([saturdayChore, regularChore], {
        today: monday,
        activeWeekdays: ['monday', 'saturday'],
      });

      // Regular chore should be planned today; Saturday chore deferred until Saturday
      assert.strictEqual(plan.todayTasks.length, 1);
      assert.strictEqual(plan.todayTasks[0].chore.name, 'Reguliere Taak');
    });

    it('overrides weekday preference if chore becomes severely overdue (>= 1.3)', () => {
      // Monday
      const monday = new Date('2025-01-06T10:00:00');

      const severelyOverdueSaturdayChore: Chore = {
        name: 'Zaterdag Schoonmaak Verwaarloosd',
        interval: { type: 'week', amount: 1, weekdays: ['saturday'] },
        // 14 days ago (ratio = 2.0 >= 1.3)
        lastPerformed: new Date('2024-12-23T10:00:00'),
      };

      const plan = planDay([severelyOverdueSaturdayChore], {
        today: monday,
        activeWeekdays: ['monday', 'saturday'],
      });

      assert.strictEqual(plan.todayTasks.length, 1);
      assert.strictEqual(plan.todayTasks[0].chore.name, 'Zaterdag Schoonmaak Verwaarloosd');
    });
  });

  describe('Dutch Example Chores List Simulation', () => {
    it('handles the full realistic list of chores gracefully', () => {
      const exampleChores: Chore[] = [
        { name: 'Wasmachine/droger/vaatwasser', interval: { type: 'month', amount: 1 } },
        { name: 'Beddengoed', interval: { type: 'week', amount: 2 } }, // 2x maand
        { name: 'Douchegordijn', interval: { type: 'month', amount: 3 } }, // kwartaal
        { name: 'Badmatjes', interval: { type: 'month', amount: 1 } },
        { name: 'Planten', interval: { type: 'week', amount: 1 } },
        { name: 'Afzuigkap', interval: { type: 'month', amount: 1 } },
        { name: 'Waterfilter', interval: { type: 'week', amount: 1 } },
        { name: 'Convectorput', interval: { type: 'month', amount: 3 } }, // kwartaal
        { name: 'Koelkast', interval: { type: 'month', amount: 1 } },
        { name: 'Gordijnen', interval: { type: 'month', amount: 12 } }, // jaarlijks
        { name: 'Oven', interval: { type: 'month', amount: 12 } }, // jaarlijks
        { name: 'Ventilatie roosters', interval: { type: 'month', amount: 12 } }, // jaarlijks
        { name: 'Dweilen', interval: { type: 'month', amount: 1 } },
        { name: 'Waterkoker ontkalken', interval: { type: 'month', amount: 1 } },
        { name: 'Matrassen keren', interval: { type: 'month', amount: 12 } }, // jaarlijks
      ];

      // Day 1 cold start with 15 chores across a standard 5-day week
      const day1Plan = planDay(exampleChores, { today: new Date('2025-01-06T10:00:00') });
      // Total workload is nicely distributed: quota should be modest (e.g. 1-3 tasks, not all 15 at once!)
      assert.ok(day1Plan.metrics.quotaForToday >= 1 && day1Plan.metrics.quotaForToday <= 3);
      assert.strictEqual(day1Plan.todayTasks.length, day1Plan.metrics.quotaForToday);

      // Simulate after 2 weeks have passed with no chores done
      const day14Plan = planDay(exampleChores, { today: new Date('2025-01-20T10:00:00') });
      // Frequent tasks (planten, waterfilter, beddengoed) should be prioritized over yearly/quarterly tasks
      assert.ok(day14Plan.todayTasks.length > 0);
      const topTask = day14Plan.todayTasks[0];
      assert.ok(topTask.intervalInDays <= 14, 'Top task should be a high frequency task');
    });
  });

  describe('Edge Cases & Robustness', () => {
    it('handles empty chore list', () => {
      const plan = planDay([]);
      assert.strictEqual(plan.todayTasks.length, 0);
      assert.strictEqual(plan.backlogTasks.length, 0);
      assert.strictEqual(plan.upcomingTasks.length, 0);
      assert.strictEqual(plan.metrics.quotaForToday, 0);
      assert.strictEqual(plan.metrics.totalDueThisWeek, 0);
    });

    it('accepts lastPerformed as ISO string', () => {
      const today = new Date('2025-01-06T10:00:00');
      const chore: Chore = {
        name: 'String Date Chore',
        interval: { type: 'week', amount: 1 },
        lastPerformed: '2024-12-30T10:00:00.000Z',
      };
      const plan = planDay([chore], { today, activeWeekdays: ['monday'] });
      assert.strictEqual(plan.todayTasks.length, 1);
      assert.strictEqual(plan.todayTasks[0].chore.name, 'String Date Chore');
    });

    it('handles when all chores are already completed this week', () => {
      const today = new Date('2025-01-08T10:00:00'); // Wednesday
      const chores: Chore[] = [
        {
          name: 'Recently done chore',
          interval: { type: 'week', amount: 1 },
          lastPerformed: new Date('2025-01-07T10:00:00'), // Done yesterday
        },
      ];
      const plan = planDay(chores, { today });
      assert.strictEqual(plan.metrics.totalDueThisWeek, 0);
      assert.strictEqual(plan.metrics.quotaForToday, 0);
      assert.strictEqual(plan.todayTasks.length, 0);
      assert.strictEqual(plan.upcomingTasks.length, 1);
    });

    it('dynamically increases quota if chores were missed on previous active days', () => {
      // 4 chores due this week (Mon-Thu active).
      const activeWeekdays: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday'];
      const chores: Chore[] = [
        { name: 'Task 1', interval: { type: 'week', amount: 1 }, lastPerformed: new Date('2024-12-30T10:00:00') },
        { name: 'Task 2', interval: { type: 'week', amount: 1 }, lastPerformed: new Date('2024-12-30T10:00:00') },
        { name: 'Task 3', interval: { type: 'week', amount: 1 }, lastPerformed: new Date('2024-12-30T10:00:00') },
        { name: 'Task 4', interval: { type: 'week', amount: 1 }, lastPerformed: new Date('2024-12-30T10:00:00') },
      ];

      // On Monday, quota was 1. But the user did nothing on Monday and Tuesday.
      // Now it's Wednesday: 4 chores due, 2 active days remaining (Wed, Thu).
      // Quota should dynamically adapt: ceil(4 / 2) = 2 tasks!
      const wednesday = new Date('2025-01-08T10:00:00');
      const planWednesday = planDay(chores, { today: wednesday, activeWeekdays });
      assert.strictEqual(planWednesday.metrics.totalDueThisWeek, 4);
      assert.strictEqual(planWednesday.metrics.remainingActiveDaysThisWeek, 2);
      assert.strictEqual(planWednesday.metrics.quotaForToday, 2);
      assert.strictEqual(planWednesday.todayTasks.length, 2);
      assert.strictEqual(planWednesday.backlogTasks.length, 2);
    });
  });
});

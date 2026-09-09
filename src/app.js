import Alpine from "alpinejs";
import { planDay, DEFAULT_ACTIVE_WEEKDAYS } from "./planner.js";

const STORAGE_KEY_CHORES = "household_chores_v1";
const STORAGE_KEY_SETTINGS = "household_settings_v1";

export const SAMPLE_CHORES = [
  {
    id: "sample-1",
    name: "Clean washing machine",
    interval: { type: "month", amount: 1 },
  },
  {
    id: "sample-2",
    name: "Wash bedsheets",
    interval: { type: "week", amount: 2 },
  },
  {
    id: "sample-3",
    name: "Water plants",
    interval: { type: "week", amount: 1, weekdays: [] },
  },
  {
    id: "sample-4",
    name: "Clean fridge",
    interval: { type: "month", amount: 1, weekdays: ["saturday"] },
  },
  {
    id: "sample-5",
    name: "Clean oven",
    interval: { type: "month", amount: 3 },
  },
  {
    id: "sample-6",
    name: "Check central heating",
    interval: { type: "month", amount: 12 },
  },
];

export const ALL_WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function loadChoresFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHORES);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    console.error("Failed to load chores from storage:", err);
    return null;
  }
}

function loadSettingsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return { activeWeekdays: [...DEFAULT_ACTIVE_WEEKDAYS] };
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.activeWeekdays)) {
      return parsed;
    }
    return { activeWeekdays: [...DEFAULT_ACTIVE_WEEKDAYS] };
  } catch (err) {
    console.error("Failed to load settings from storage:", err);
    return { activeWeekdays: [...DEFAULT_ACTIVE_WEEKDAYS] };
  }
}

Alpine.data("householdApp", () => ({
  chores: [],
  settings: {
    activeWeekdays: [...DEFAULT_ACTIVE_WEEKDAYS],
  },
  currentPage: "today",
  editingId: null,
  showUpcoming: false,
  showBacklog: true,
  restoreText: "",
  toasts: [],
  allWeekdays: ALL_WEEKDAYS,

  form: {
    id: "",
    name: "",
    type: "week",
    amount: 1,
    weekdays: [],
    lastPerformedDate: "",
  },

  init() {
    const storedChores = loadChoresFromStorage();
    if (storedChores === null) {
      // First run: Seed with sample chores
      this.chores = SAMPLE_CHORES.map((c) => ({ ...c }));
      this.saveChoresToStorage();
    } else {
      this.chores = storedChores;
    }

    this.settings = loadSettingsFromStorage();

    window.addEventListener("hashchange", () => {
      this.handleHashChange();
    });
    this.handleHashChange();
  },

  handleHashChange() {
    const hash = window.location.hash.replace(/^#\/?/, "");
    if (!hash || hash === "today") {
      this.currentPage = "today";
      this.editingId = null;
    } else if (hash === "settings") {
      this.currentPage = "settings";
      this.editingId = null;
    } else if (hash === "add") {
      this.openAddChore();
    } else if (hash.startsWith("edit/")) {
      const id = hash.replace("edit/", "");
      this.openEditChore(id);
    } else {
      this.currentPage = "today";
    }
  },

  navigateTo(page, param) {
    if (param) {
      window.location.hash = `#${page}/${param}`;
    } else {
      window.location.hash = `#${page}`;
    }
  },

  goBack() {
    if (this.currentPage === "edit" || this.currentPage === "add") {
      window.location.hash = "#settings";
    } else {
      window.location.hash = "#today";
    }
  },

  get plan() {
    return planDay(this.chores, {
      today: new Date(),
      activeWeekdays: this.settings.activeWeekdays,
    });
  },

  get formattedTodayDate() {
    const now = new Date();
    return now.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  },

  saveChoresToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_CHORES, JSON.stringify(this.chores));
    } catch (err) {
      console.error("Failed to save chores:", err);
    }
  },

  saveSettingsToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  },

  markDone(choreId) {
    const chore = this.chores.find(
      (c) => (c.id && c.id === choreId) || c.name === choreId,
    );
    if (!chore) return;

    chore.lastPerformed = new Date().toISOString();
    this.saveChoresToStorage();
    this.addToast(`Done: "${chore.name}" 🎉`);
  },

  openAddChore() {
    this.editingId = null;
    this.form = {
      id: "",
      name: "",
      type: "week",
      amount: 1,
      weekdays: [],
      lastPerformedDate: "",
    };
    this.currentPage = "add";
  },

  openEditChore(id) {
    const chore = this.chores.find(
      (c) => (c.id && c.id === id) || c.name === id,
    );
    if (!chore) {
      this.navigateTo("settings");
      return;
    }

    let lastPerf = "";
    if (chore.lastPerformed) {
      const d = new Date(chore.lastPerformed);
      if (!isNaN(d.getTime())) {
        lastPerf = d.toISOString().slice(0, 10);
      }
    }

    this.editingId = chore.id || chore.name;
    this.form = {
      id: chore.id || "",
      name: chore.name,
      type: chore.interval.type,
      amount: chore.interval.amount || 1,
      weekdays: Array.isArray(chore.interval.weekdays)
        ? [...chore.interval.weekdays]
        : [],
      lastPerformedDate: lastPerf,
    };
    this.currentPage = "edit";
  },

  toggleFormWeekday(day) {
    const idx = this.form.weekdays.indexOf(day);
    if (idx >= 0) {
      this.form.weekdays.splice(idx, 1);
    } else {
      this.form.weekdays.push(day);
    }
  },

  isFormWeekdaySelected(day) {
    return this.form.weekdays.includes(day);
  },

  toggleActiveWeekday(day) {
    const idx = this.settings.activeWeekdays.indexOf(day);
    if (idx >= 0) {
      if (this.settings.activeWeekdays.length <= 1) {
        this.addToast("Must keep at least 1 active day");
        return;
      }
      this.settings.activeWeekdays.splice(idx, 1);
    } else {
      this.settings.activeWeekdays.push(day);
    }
    this.saveSettingsToStorage();
  },

  isActiveWeekday(day) {
    return this.settings.activeWeekdays.includes(day);
  },

  saveChore() {
    const name = (this.form.name || "").trim();
    if (!name) {
      this.addToast("Please enter a chore name");
      return;
    }

    const amount = Math.max(1, Number(this.form.amount) || 1);
    const type = this.form.type || "week";
    const weekdays =
      this.form.weekdays.length > 0 ? [...this.form.weekdays] : undefined;

    let lastPerformed = undefined;
    if (this.form.lastPerformedDate) {
      const parsed = new Date(this.form.lastPerformedDate);
      if (!isNaN(parsed.getTime())) {
        lastPerformed = parsed.toISOString();
      }
    }

    if (this.editingId) {
      const chore = this.chores.find(
        (c) => (c.id && c.id === this.editingId) || c.name === this.editingId,
      );
      if (chore) {
        chore.name = name;
        chore.interval = { type, amount, weekdays };
        if (this.form.lastPerformedDate !== "") {
          chore.lastPerformed = lastPerformed;
        }
      }
      this.addToast(`Updated "${name}"`);
    } else {
      const newChore = {
        id: crypto.randomUUID(),
        name,
        interval: { type, amount, weekdays },
        lastPerformed,
      };
      this.chores.push(newChore);
      this.addToast(`Added "${name}"`);
    }

    this.saveChoresToStorage();
    this.navigateTo("today");
  },

  deleteChore(id) {
    const idx = this.chores.findIndex(
      (c) => (c.id && c.id === id) || c.name === id,
    );
    if (idx >= 0) {
      const removed = this.chores.splice(idx, 1)[0];
      this.saveChoresToStorage();
      this.addToast(`Deleted "${removed.name}"`);
    }
  },

  formatInterval(interval) {
    if (!interval) return "";
    const { type, amount } = interval;
    const amt = amount || 1;

    if (type === "day") {
      return amt === 1 ? "Daily" : `Every ${amt} days`;
    }
    if (type === "week") {
      return amt === 1 ? "Weekly" : `Every ${amt} weeks`;
    }
    if (type === "month") {
      if (amt === 1) return "Monthly";
      if (amt === 3) return "Quarterly (3 mo)";
      if (amt === 6) return "Semi-annually (6 mo)";
      if (amt === 12) return "Yearly (12 mo)";
      return `Every ${amt} months`;
    }
    return `${amt} ${type}(s)`;
  },

  formatLastDone(chore) {
    if (!chore.lastPerformed) return "Not performed yet (staggered)";
    const date = new Date(chore.lastPerformed);
    if (isNaN(date.getTime())) return "Not performed yet";
    const days = Math.floor(
      (new Date().getTime() - date.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
  },

  exportJSON() {
    return JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: this.settings,
        chores: this.chores,
      },
      null,
      2,
    );
  },

  async copyExport() {
    try {
      await navigator.clipboard.writeText(this.exportJSON());
      this.addToast("Copied backup to clipboard!");
    } catch (err) {
      console.error("Failed to copy:", err);
      this.addToast("Failed to copy — select text manually");
    }
  },

  restoreFromJSON(text) {
    if (!text || !text.trim()) {
      this.addToast("Please paste JSON backup first");
      return;
    }
    try {
      const parsed = JSON.parse(text.trim());
      if (!Array.isArray(parsed.chores)) {
        this.addToast("Invalid JSON: missing chores array");
        return;
      }
      this.chores = parsed.chores;
      if (parsed.settings && Array.isArray(parsed.settings.activeWeekdays)) {
        this.settings = parsed.settings;
      }
      this.saveChoresToStorage();
      this.saveSettingsToStorage();
      this.restoreText = "";
      this.addToast("Successfully restored data! 🎉");
      this.navigateTo("today");
    } catch (err) {
      console.error("Restore failed:", err);
      this.addToast("Invalid JSON format");
    }
  },

  loadSampleChores() {
    this.chores = SAMPLE_CHORES.map((c) => ({
      ...c,
      id: crypto.randomUUID(),
    }));
    this.saveChoresToStorage();
    this.addToast("Loaded 15 sample chores! 🎉");
  },

  addToast(message) {
    const id = Date.now() + Math.random();
    this.toasts.push({ id, message });
    setTimeout(() => {
      this.removeToast(id);
    }, 3000);
  },

  removeToast(id) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  },
}));

Alpine.start();

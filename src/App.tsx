import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Download,
  Home,
  Import,
  ListTodo,
  MessageSquarePlus,
  Moon,
  PawPrint,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Stethoscope,
  Sun,
  Target,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { FeedbackWizard } from "./components";
import { NotificationBell } from "./views";
import {
  AnalyticsView,
  DashboardView,
  CalendarView,
  HealthView,
  JournalView,
  MilestonesView,
  ProfileView,
  SettingsView,
  TasksView,
  TrainingView,
} from "./views";
import { DataProvider, useStore } from "./store";
import { AuthGate } from "./auth";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "profile", label: "Profile", icon: Users },
  { id: "training", label: "Training", icon: Target },
  { id: "health", label: "Health", icon: Stethoscope },
  { id: "journal", label: "Journal", icon: ClipboardList },
  { id: "milestones", label: "Milestones", icon: ShieldCheck },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

const searchTargets: Record<string, string> = { Task: "tasks", Milestone: "milestones", Journal: "journal" };

const themeKey = "dog-life-os-theme";
const largeTextKey = "dog-life-os-large-text";

type Theme = "light" | "dark";

function loadTheme(): Theme {
  try {
    return localStorage.getItem(themeKey) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function loadLargeText(): boolean {
  try {
    return localStorage.getItem(largeTextKey) === "true";
  } catch {
    return false;
  }
}

function Shell() {
  const store = useStore();
  const [active, setActive] = useState("dashboard");
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [largeText, setLargeText] = useState<boolean>(loadLargeText);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const currentPageLabel = navItems.find((item) => item.id === active)?.label ?? active;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(themeKey, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.largeText = String(largeText);
    localStorage.setItem(largeTextKey, String(largeText));
  }, [largeText]);

  const searchResults = useMemo(() => {
    const haystack = [
      ...store.tasks.items.map((item) => ({ type: "Task", title: item.title, detail: item.notes })),
      ...store.milestones.items.map((item) => ({ type: "Milestone", title: item.title, detail: item.why })),
      ...store.journalEntries.items.map((item) => ({ type: "Journal", title: item.title, detail: item.text })),
    ];
    return query ? haystack.filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(query.toLowerCase())) : [];
  }, [query, store.tasks.items, store.milestones.items, store.journalEntries.items]);

  function exportData() {
    const payload = store.snapshot();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "dog-life-os-export.json";
    link.click();
  }

  async function importData(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      store.restore(parsed);
    } catch {
      window.alert("That file could not be read as a Dog Life OS export.");
    }
  }

  function selectResult(result: { type: string; title: string }) {
    setActive(searchTargets[result.type] ?? "dashboard");
    setQuery("");
  }

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <PawPrint size={26} aria-hidden />
          <div>
            <strong>Dog Life OS</strong>
            <span>Andrew + Bree</span>
          </div>
        </div>
        <nav>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button className={active === id ? "active" : ""} key={id} type="button" onClick={() => setActive(id)}>
              <Icon size={18} aria-hidden />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <button className="sidebar-feedback" type="button" onClick={() => setFeedbackOpen(true)}>
          <MessageSquarePlus size={18} aria-hidden />
          <span>Feedback</span>
        </button>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">Adaptive puppy raising & household planning</p>
            <h1>Lifelong dog companion system</h1>
          </div>
          <div className="top-actions">
            <label className="search">
              <Search size={17} aria-hidden />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes, vaccines, walks" />
            </label>
            <NotificationBell />
            <button className="icon-button" type="button" onClick={exportData} aria-label="Export data">
              <Download size={18} aria-hidden />
            </button>
            <button className="icon-button" type="button" onClick={() => importInputRef.current?.click()} aria-label="Import data">
              <Import size={18} aria-hidden />
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) importData(file);
                event.target.value = "";
              }}
            />
            <button
              className="icon-button"
              type="button"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              aria-label="Toggle dark mode"
            >
              {theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
            </button>
          </div>
        </header>

        {query && (
          <section className="search-results">
            {searchResults.map((result) => (
              <button key={`${result.type}-${result.title}`} type="button" onClick={() => selectResult(result)}>
                <span>{result.type}</span>
                <strong>{result.title}</strong>
                <ChevronRight size={16} aria-hidden />
              </button>
            ))}
            {searchResults.length === 0 && (
              <p className="search-empty">No matches for "{query}" in tasks, milestones, or journal entries.</p>
            )}
          </section>
        )}

        {active === "dashboard" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <DashboardView />
          </motion.div>
        )}
        {active === "calendar" && <CalendarView />}
        {active === "profile" && <ProfileView />}
        {active === "training" && <TrainingView />}
        {active === "health" && <HealthView />}
        {active === "journal" && <JournalView />}
        {active === "milestones" && <MilestonesView />}
        {active === "tasks" && <TasksView />}
        {active === "analytics" && <AnalyticsView />}
        {active === "settings" && (
          <SettingsView
            theme={theme}
            onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            largeText={largeText}
            onToggleLargeText={() => setLargeText((current) => !current)}
            onExport={exportData}
            onImportClick={() => importInputRef.current?.click()}
          />
        )}
      </main>

      {feedbackOpen && <FeedbackWizard page={currentPageLabel} onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}

export function App() {
  return (
    <AuthGate>
      <DataProvider>
        <Shell />
      </DataProvider>
    </AuthGate>
  );
}

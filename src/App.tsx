import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Home,
  Inbox as InboxIcon,
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
  UtensilsCrossed,
  Users,
  X,
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
  InboxView,
  JournalView,
  MealsView,
  MilestonesView,
  ProfileView,
  SettingsView,
  TasksView,
  TrainingView,
} from "./views";
import { DataProvider, useStore } from "./store";
import { AuthGate } from "./auth";
import { NavigationProvider, useNavigation } from "./navigation";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "profile", label: "Profile", icon: Users },
  { id: "training", label: "Training", icon: Target },
  { id: "health", label: "Health", icon: Stethoscope },
  { id: "journal", label: "Journal", icon: ClipboardList },
  { id: "milestones", label: "Milestones", icon: ShieldCheck },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "inbox", label: "Inbox", icon: InboxIcon },
  { id: "meals", label: "Meals", icon: UtensilsCrossed },
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
  const { view: active, navigate } = useNavigation();
  const setActive = (id: string) => navigate(id as Parameters<typeof navigate>[0]);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
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
    setSearchOpen(false);
  }

  function openSearch() {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  function closeSearch() {
    setSearchOpen(false);
    setQuery("");
  }

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <div className="brand-mark">
            <PawPrint size={26} aria-hidden />
            <div>
              <strong>Dog Life OS</strong>
              <span>Andrew + Bree</span>
            </div>
          </div>
          <div className="top-actions">
            {!searchOpen && (
              <button className="icon-button" type="button" onClick={openSearch} aria-label="Search">
                <Search size={18} aria-hidden />
              </button>
            )}
            <NotificationBell />
            <button
              className="icon-button"
              type="button"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              aria-label="Toggle dark mode"
            >
              {theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
            </button>
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
      </aside>

      <main>
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

        {searchOpen && (
          <section className="search-overlay">
            <label className="search">
              <Search size={17} aria-hidden />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tasks, milestones, journal notes…"
              />
              <button className="text-button" type="button" onClick={closeSearch} aria-label="Close search">
                <X size={16} aria-hidden />
              </button>
            </label>
            {!query && <p className="search-empty">Type to search across tasks, milestones, and journal entries.</p>}
            {query && (
              <div className="search-results">
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
              </div>
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
        {active === "inbox" && <InboxView />}
        {active === "meals" && <MealsView />}
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

      <button className="feedback-fab" type="button" onClick={() => setFeedbackOpen(true)} aria-label="Send feedback">
        <MessageSquarePlus size={20} aria-hidden />
      </button>

      {feedbackOpen && <FeedbackWizard page={currentPageLabel} onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}

export function App() {
  return (
    <AuthGate>
      <DataProvider>
        <NavigationProvider>
          <Shell />
        </NavigationProvider>
      </DataProvider>
    </AuthGate>
  );
}

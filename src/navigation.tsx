import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { defaultTimezoneId } from "./timezones";

export type ViewId =
  | "dashboard"
  | "calendar"
  | "profile"
  | "training"
  | "health"
  | "journal"
  | "milestones"
  | "tasks"
  | "inbox"
  | "meals"
  | "analytics"
  | "settings";

export type FocusTarget = { dogId?: string; milestoneId?: string } | null;

const timezoneStorageKey = "dog-life-os-timezone";

function loadTimezone(): string {
  try {
    return localStorage.getItem(timezoneStorageKey) || defaultTimezoneId;
  } catch {
    return defaultTimezoneId;
  }
}

type NavigationContextValue = {
  view: ViewId;
  focus: FocusTarget;
  navigate: (view: ViewId, focus?: FocusTarget) => void;
  clearFocus: () => void;
  timezone: string;
  setTimezone: (zoneId: string) => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewId>("dashboard");
  const [focus, setFocus] = useState<FocusTarget>(null);
  const [timezone, setTimezone] = useState<string>(loadTimezone);

  useEffect(() => {
    try {
      localStorage.setItem(timezoneStorageKey, timezone);
    } catch {
      // ignore
    }
  }, [timezone]);

  function navigate(nextView: ViewId, nextFocus: FocusTarget = null) {
    setView(nextView);
    setFocus(nextFocus);
  }

  return (
    <NavigationContext.Provider value={{ view, focus, navigate, clearFocus: () => setFocus(null), timezone, setTimezone }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error("useNavigation must be used within NavigationProvider");
  return ctx;
}

import { createContext, ReactNode, useContext, useState } from "react";

export type ViewId =
  | "dashboard"
  | "calendar"
  | "profile"
  | "training"
  | "health"
  | "journal"
  | "milestones"
  | "tasks"
  | "analytics"
  | "settings";

export type FocusTarget = { dogId?: string; milestoneId?: string } | null;

type NavigationContextValue = {
  view: ViewId;
  focus: FocusTarget;
  navigate: (view: ViewId, focus?: FocusTarget) => void;
  clearFocus: () => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewId>("dashboard");
  const [focus, setFocus] = useState<FocusTarget>(null);

  function navigate(nextView: ViewId, nextFocus: FocusTarget = null) {
    setView(nextView);
    setFocus(nextFocus);
  }

  return (
    <NavigationContext.Provider value={{ view, focus, navigate, clearFocus: () => setFocus(null) }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error("useNavigation must be used within NavigationProvider");
  return ctx;
}

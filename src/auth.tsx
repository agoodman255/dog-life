import type { Session } from "@supabase/supabase-js";
import { PawPrint } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { getSupabaseClient, isBackendConfigured } from "./supabaseClient";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isBackendConfigured());

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

export async function signOut() {
  const supabase = getSupabaseClient();
  if (supabase) await supabase.auth.signOut();
}

export async function setPassword(password: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [status, setStatus] = useState<{ kind: "idle" | "sent" | "error"; message?: string }>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);

  async function sendMagicLink(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !email) return;
    setSubmitting(true);
    const redirectTo = window.location.origin + import.meta.env.BASE_URL;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setSubmitting(false);
    setStatus(error ? { kind: "error", message: error.message } : { kind: "sent", message: `Check ${email} for a sign-in link.` });
  }

  async function signInWithPassword(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !email || !password) return;
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) setStatus({ kind: "error", message: error.message });
  }

  return (
    <div className="auth-screen">
      <form className="auth-card entity-form" onSubmit={mode === "magic" ? sendMagicLink : signInWithPassword}>
        <div className="brand auth-brand">
          <PawPrint size={26} aria-hidden />
          <div>
            <strong>Dog Life OS</strong>
            <span>Sign in to sync your household's data</span>
          </div>
        </div>
        <div className="subtabs">
          <button type="button" className={mode === "magic" ? "active" : ""} onClick={() => setMode("magic")}>
            Magic link
          </button>
          <button type="button" className={mode === "password" ? "active" : ""} onClick={() => setMode("password")}>
            Password
          </button>
        </div>
        <label>
          Email
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        </label>
        {mode === "password" && (
          <label>
            Password
            <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
        )}
        {status.kind === "sent" && <p className="form-success">{status.message}</p>}
        {status.kind === "error" && <p className="form-error">{status.message}</p>}
        <button className="primary-button" type="submit" disabled={submitting}>
          {mode === "magic" ? "Send magic link" : "Sign in"}
        </button>
        <p className="small">
          {mode === "magic"
            ? "First time? A magic link creates your account automatically — no separate sign-up needed."
            : "No password yet? Sign in with a magic link once, then set a password from Settings."}
        </p>
      </form>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  if (!isBackendConfigured()) return <>{children}</>;
  if (loading) return <div className="auth-loading">Loading…</div>;
  if (!session) return <LoginScreen />;
  return <>{children}</>;
}

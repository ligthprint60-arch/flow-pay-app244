import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Вход — FLOW" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/wallet", replace: true });
  }, [user, loading, navigate]);

  if (user) return <Navigate to="/wallet" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Аккаунт создан");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-svh overflow-hidden">
      <div className="relative mx-auto flex min-h-svh max-w-md flex-col px-6 pb-10 pt-16">
        <div className="mb-12 flex items-center gap-2">
          <div className="size-7 rounded-xl bg-gradient-to-br from-eco to-fiat emissive-eco" />
          <span className="text-lg font-bold tracking-tight chromatic">FLOW</span>
          <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">FLDS 3.0</span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-balance">
          {mode === "signin" ? "С возвращением." : "Создайте кошелёк."}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Войдите, чтобы продолжить."
            : "Получите 500 000 rFLOW на старт и доступ к экосистеме."}
        </p>

        <form onSubmit={submit} className="lrf lrf-thick mt-10 p-5">
          <div className="relative z-10 space-y-3">
            {mode === "signup" && (
              <Field
                label="Имя"
                value={displayName}
                onChange={setDisplayName}
                placeholder="Как вас называть"
              />
            )}
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@flow.network"
              required
            />
            <Field
              label="Пароль"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="Минимум 6 символов"
              required
            />

            <button
              type="submit"
              disabled={busy}
              className="mercury mt-6 flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold disabled:opacity-50"
            >
              {busy ? "..." : mode === "signin" ? "Войти" : "Создать аккаунт"}
            </button>
          </div>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? (
            <>Нет аккаунта? <span className="text-foreground underline underline-offset-4">Создать</span></>
          ) : (
            <>Уже есть аккаунт? <span className="text-foreground underline underline-offset-4">Войти</span></>
          )}
        </button>

        <div className="mt-auto pt-12 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          FLOW NETWORK · 2026 · Spatial Glass
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-eco/60 focus:ring-2 focus:ring-eco/30"
      />
    </label>
  );
}

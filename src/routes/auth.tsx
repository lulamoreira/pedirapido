import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Droplet, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const go = (email?: string | null) => {
      const master = !!email && ["lula1973@gmail.com", "lula1973@gmail.com.br"].includes(email.toLowerCase());
      navigate({ to: master ? "/admin" : "/dashboard", replace: true });
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go(data.session.user.email);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) go(session.user.email);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { nome_distribuidora: nome || "Minha Distribuidora" },
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/dashboard", replace: true });
        } else {
          toast.success("Conta criada! Confirme seu e-mail para entrar.");
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Falha ao entrar com Google");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="mb-6 flex items-center gap-2">
        <div className="grid h-10 w-10 place-items-center rounded-2xl gradient-primary">
          <Droplet className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-black">Pedirápido</span>
      </Link>

      <div className="w-full max-w-sm card-float p-6">
        <h1 className="text-2xl font-black tracking-tight">
          {mode === "login" ? "Entrar" : "Criar conta"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login"
            ? "Acesse sua distribuidora"
            : "Grátis por 14 dias no plano Pro"}
        </p>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-semibold shadow-soft transition hover:bg-secondary disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continuar com Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Nome da distribuidora"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-soft transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        {mode === "login" && (
          <button
            type="button"
            onClick={async () => {
              if (!email) {
                toast.error("Digite seu e-mail primeiro");
                return;
              }
              try {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: window.location.origin + "/auth",
                });
                if (error) throw error;
                toast.success("Enviamos um link de redefinição para seu e-mail.");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Erro ao enviar link");
              }
            }}
            className="mt-3 w-full text-center text-xs font-semibold text-primary hover:underline"
          >
            Esqueci minha senha
          </button>
        )}

        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "login"
            ? "Não tem conta? Criar agora"
            : "Já tem conta? Entrar"}
        </button>
      </div>
    </div>
  );
}

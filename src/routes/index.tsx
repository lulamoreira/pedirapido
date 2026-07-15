import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Droplet, MessageCircle, Zap, Bike, BarChart3, ShieldCheck, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isMasterEmail } from "@/lib/isMaster";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user.email;
      if (email) {
        navigate({ to: isMasterEmail(email) ? "/admin" : "/dashboard", replace: true });
        return;
      }
      setChecking(false);
    });
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-2xl gradient-primary">
              <Droplet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-black tracking-tight">Pedirápido</span>
          </div>
          <Link
            to="/auth"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition-transform hover:scale-105"
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:py-24">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              <Zap className="h-3.5 w-3.5" /> Novo · WhatsApp + PIX automático
            </span>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight md:text-6xl">
              Pedidos de água <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">no piloto automático</span>.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Sua distribuidora recebe pedidos pelo WhatsApp, cobra por PIX e envia
              para a rota do entregador — tudo em um só painel, no seu celular.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="rounded-full gradient-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-float transition-transform hover:scale-105"
              >
                Começar grátis por 14 dias
              </Link>
              <a
                href="#recursos"
                className="rounded-full bg-card px-6 py-3 text-sm font-semibold text-foreground shadow-soft"
              >
                Ver recursos
              </a>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Sem cartão de crédito · Cancele quando quiser</p>
          </div>

          {/* Phone mock */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="rounded-[2.5rem] border-8 border-foreground/90 bg-background p-3 shadow-float">
              <div className="rounded-[2rem] bg-background p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-bold">Pedidos ativos</span>
                  <span className="rounded-full bg-status-paid-bg px-2 py-0.5 text-xs font-bold text-status-paid">3 novos</span>
                </div>
                {[
                  { n: "Ana Silva", i: "2× Galão 20L", s: "pago", c: "bg-status-paid-bg text-status-paid" },
                  { n: "Carlos M.", i: "1× Galão 20L", s: "pendente", c: "bg-status-pending-bg text-status-pending" },
                  { n: "Loja Beta", i: "6× Pack 1,5L", s: "preparo", c: "bg-status-preparing-bg text-status-preparing" },
                ].map((p, i) => (
                  <div key={i} className="mb-2 flex items-center justify-between rounded-2xl bg-secondary/60 p-3">
                    <div>
                      <div className="text-sm font-semibold">{p.n}</div>
                      <div className="text-xs text-muted-foreground">{p.i}</div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.c}`}>{p.s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="text-center text-3xl font-black tracking-tight md:text-4xl">Tudo que uma distribuidora precisa</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { i: MessageCircle, t: "Pedidos via WhatsApp", d: "Webhook pronto para receber pedidos direto da conversa do cliente." },
            { i: Zap, t: "PIX automático", d: "Gera o Copia e Cola no ato e confirma o pagamento em segundos." },
            { i: Bike, t: "App do entregador", d: "Rota otimizada com Waze/Maps e botão único para marcar entregue." },
            { i: BarChart3, t: "Estoque em tempo real", d: "Alerta de galões acabando antes que você perca uma venda." },
            { i: ShieldCheck, t: "Multi-distribuidora", d: "Cada empresa vê só seus dados. Seguro por padrão." },
            { i: Droplet, t: "Feito para água", d: "Do galão de 20L ao pack, tudo pensado para o seu negócio." },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="card-float p-5">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 text-base font-bold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-3xl gradient-primary p-8 text-center text-primary-foreground shadow-float md:p-12">
          <h3 className="text-2xl font-black md:text-3xl">Teste o Pedirápido grátis por 14 dias</h3>
          <p className="mx-auto mt-2 max-w-xl opacity-90">Acesso completo ao plano Pro. Sem cartão. Ative em menos de 2 minutos.</p>
          <Link
            to="/auth"
            className="mt-6 inline-flex rounded-full bg-background px-6 py-3 text-sm font-bold text-primary shadow-float"
          >
            Criar minha conta
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Pedirápido · Feito para distribuidoras de água mineral
      </footer>
    </main>
  );
}

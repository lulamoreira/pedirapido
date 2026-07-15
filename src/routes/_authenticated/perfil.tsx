import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPlano } from "@/lib/aquaflow.functions";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, LogOut, Zap, Crown, Building2, Check } from "lucide-react";
import { daysUntil } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: Perfil,
});

const PLANOS = [
  { id: "free", nome: "Free", preco: "R$ 0", icon: Zap, cor: "text-muted-foreground", bg: "bg-secondary", features: ["Até 50 pedidos/mês", "1 entregador", "Suporte por e-mail"] },
  { id: "pro", nome: "Pro", preco: "R$ 79/mês", icon: Crown, cor: "text-primary-foreground", bg: "gradient-primary", features: ["Pedidos ilimitados", "3 entregadores", "PIX automático", "Relatórios"], destaque: true },
  { id: "business", nome: "Business", preco: "R$ 199/mês", icon: Building2, cor: "text-primary-foreground", bg: "bg-foreground", features: ["Tudo do Pro", "Entregadores ilimitados", "Multi-unidade", "API + Webhooks"] },
] as const;

function Perfil() {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["plano"], queryFn: () => getPlano() });

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="p-4 pb-8">
      <div className="flex items-center gap-3 pt-2">
        <Link to="/dashboard" className="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-soft">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-black">Perfil & Plano</h1>
      </div>

      {data && (
        <div className="card-float mt-4 p-5">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Distribuidora</div>
          <div className="mt-1 text-lg font-black">{data.distribuidora.nome}</div>
          <div className="mt-3 flex items-center justify-between">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase text-primary">
              Plano {data.distribuidora.plano}
            </span>
            {data.distribuidora.plano === "free" && daysUntil(data.distribuidora.trial_expires_at) > 0 && (
              <span className="text-xs text-muted-foreground">
                Trial Pro: {daysUntil(data.distribuidora.trial_expires_at)}d
              </span>
            )}
          </div>
        </div>
      )}

      <h2 className="mt-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">Escolha seu plano</h2>
      <div className="mt-3 space-y-3">
        {PLANOS.map((p) => {
          const Icon = p.icon;
          const atual = data?.distribuidora.plano === p.id;
          return (
            <div key={p.id} className={"card-float p-5 " + (("destaque" in p && p.destaque) ? "ring-2 ring-primary" : "")}>
              <div className="flex items-center gap-3">
                <div className={"grid h-11 w-11 place-items-center rounded-2xl " + p.bg + " " + p.cor}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-base font-black">{p.nome}</div>
                  <div className="text-xs text-muted-foreground">{p.preco}</div>
                </div>
                {atual && <span className="rounded-full bg-status-paid-bg px-2 py-1 text-[10px] font-bold uppercase text-status-paid">Atual</span>}
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-status-paid" /> {f}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <button onClick={logout} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-destructive/10 py-3 text-sm font-bold text-destructive">
        <LogOut className="h-4 w-4" /> Sair
      </button>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/aquaflow.functions";
import { formatBRL, daysUntil } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { Bell, TrendingUp, Package, AlertTriangle, Sparkles } from "lucide-react";

const dashOpts = queryOptions({
  queryKey: ["dashboard"],
  queryFn: () => getDashboard(),
  staleTime: 15_000,
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashOpts),
  component: Dashboard,
  pendingComponent: () => <div className="p-4 text-sm text-muted-foreground">Carregando…</div>,
  errorComponent: ({ error }) => <div className="p-4 text-sm text-destructive">{error.message}</div>,
});

function Dashboard() {
  const { data } = useSuspenseQuery(dashOpts);
  const trialDays = daysUntil(data.distribuidora.trial_expires_at);
  const isFree = data.distribuidora.plano === "free";
  const usoPct = Math.min(100, Math.round((data.totalMes / data.limiteFree) * 100));

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Olá,</p>
          <h1 className="truncate text-xl font-black tracking-tight">{data.distribuidora.nome}</h1>
        </div>
        <button className="grid h-11 w-11 place-items-center rounded-2xl bg-card shadow-soft" aria-label="Notificações">
          <Bell className="h-5 w-5" />
        </button>
      </div>

      {/* Trial banner */}
      {isFree && trialDays > 0 && (
        <Link to="/plano" className="flex items-center gap-3 rounded-2xl gradient-primary p-4 text-primary-foreground shadow-float">
          <Sparkles className="h-6 w-6 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">Teste Pro grátis</div>
            <div className="text-xs opacity-90">{trialDays} {trialDays === 1 ? "dia restante" : "dias restantes"}</div>
          </div>
          <span className="rounded-full bg-primary-foreground/20 px-3 py-1 text-xs font-bold">Ver</span>
        </Link>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card-float p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <TrendingUp className="h-4 w-4" /> Hoje
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight">{formatBRL(data.receitaHoje)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{data.totalHoje} pedidos</div>
        </div>
        <div className="card-float p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Package className="h-4 w-4" /> Este mês
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight">{data.totalMes}</div>
          {isFree ? (
            <div className="mt-1">
              <div className="h-1.5 w-full rounded-full bg-secondary">
                <div className="h-full rounded-full gradient-primary" style={{ width: `${usoPct}%` }} />
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">{data.totalMes}/{data.limiteFree} do plano Free</div>
            </div>
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">pedidos ilimitados</div>
          )}
        </div>
      </div>

      {/* Estoque baixo */}
      {data.estoqueBaixo.length > 0 && (
        <div className="rounded-2xl border border-status-preparing/30 bg-status-preparing-bg p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-status-preparing">
            <AlertTriangle className="h-4 w-4" /> Estoque baixo
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {data.estoqueBaixo.map((p) => (
              <li key={p.id} className="flex justify-between"><span>{p.nome}</span><span className="font-bold">{p.estoque} un</span></li>
            ))}
          </ul>
          <Link to="/estoque" className="mt-3 inline-block text-xs font-semibold text-status-preparing underline">Repor estoque →</Link>
        </div>
      )}

      {/* Pedidos ativos */}
      <div className="card-float">
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="text-base font-bold">Pedidos ativos</h2>
          <Link to="/pedidos" className="text-xs font-semibold text-primary">Ver todos</Link>
        </div>
        {data.pedidosAtivos.length === 0 ? (
          <div className="px-4 pb-5 text-sm text-muted-foreground">Nenhum pedido ativo. Envie o webhook para simular! 💧</div>
        ) : (
          <ul className="divide-y divide-border">
            {data.pedidosAtivos.map((p) => (
              <li key={p.id}>
                <Link to="/pedidos/$id" params={{ id: p.id }} className="flex items-center justify-between gap-3 p-4 hover:bg-secondary/40">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{p.cliente?.nome ?? "Cliente"}</div>
                    <div className="text-xs text-muted-foreground">{formatBRL(p.total)}</div>
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

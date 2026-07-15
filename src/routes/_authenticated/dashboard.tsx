import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getDashboard } from "@/lib/aquaflow.functions";
import { formatBRL, daysUntil } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { NovoPedidoModal } from "@/components/NovoPedidoModal";
import { ClienteProfileSheet } from "@/components/ClienteProfileSheet";
import { PreOrderSummaryModal } from "@/components/PreOrderSummaryModal";
import { usePreOrderRealtime } from "@/hooks/usePreOrderRealtime";
import { unlockAudio } from "@/lib/notify-sound";
import { useSessionUser } from "@/hooks/useSessionUser";
import { isMasterEmail } from "@/lib/isMaster";
import { TrendingUp, Package, AlertTriangle, Sparkles, Plus, Shield, Globe, Share2, Moon } from "lucide-react";
import { toast } from "sonner";



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
  const [showNovo, setShowNovo] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null);

  const { user } = useSessionUser();
  const clientMaster = isMasterEmail(user?.email);
  
  const trialDays = daysUntil(data.distribuidora.trial_expires_at);
  const isFree = data.distribuidora.plano === "free";
  const usoPct = Math.min(100, Math.round((data.totalMes / data.limiteFree) * 100));
  const showMasterBtn = data.isAdminMaster || clientMaster;

  // Realtime: novo pré-pedido → som + toast
  usePreOrderRealtime(data.distribuidora.id);
  // Destrava o áudio no primeiro clique do usuário no dashboard
  useEffect(() => {
    const h = () => { unlockAudio(); window.removeEventListener("click", h); };
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, []);

  return (
    <div className="space-y-4 p-4">
      <PreOrderSummaryModal distribuidoraId={data.distribuidora.id} />

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3 min-w-0">
          {data.distribuidora.logo_url ? (
            <img src={data.distribuidora.logo_url} alt="" className="h-11 w-11 rounded-2xl object-contain bg-white shadow-soft shrink-0" />
          ) : null}
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Olá,</p>
            <h1 className="truncate text-xl font-black tracking-tight">{data.distribuidora.nome_fantasia ?? data.distribuidora.nome}</h1>
          </div>
        </div>

        <div className="flex gap-2">
          {showMasterBtn && (
            <Link to="/admin" className="grid h-11 w-11 place-items-center rounded-2xl gradient-primary text-primary-foreground shadow-soft" aria-label="Admin Master">
              <Shield className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>

      {/* Cardápio Digital Público */}
      {(() => {
        const slug = (data.distribuidora as any).slug ?? data.distribuidora.id;
        const lojaPath = `/loja/${slug}`;
        const lojaUrl = typeof window !== "undefined" ? `${window.location.origin}${lojaPath}` : `https://pedirapido.lovable.app${lojaPath}`;
        const displayUrl = lojaUrl.replace(/^https?:\/\//, "");
        const copiar = async () => {
          try {
            await navigator.clipboard.writeText(lojaUrl);
            toast.success("Link copiado! Compartilhe com seus clientes no WhatsApp. 🚀");
          } catch {
            toast.error("Não foi possível copiar o link");
          }
        };
        return (
          <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-card p-3 shadow-soft">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Globe className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-primary">Seu cardápio digital</p>
              <a
                href={lojaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-sm font-bold text-foreground hover:underline"
                title={displayUrl}
              >
                {displayUrl}
              </a>
            </div>
            <button
              onClick={copiar}
              aria-label="Copiar link do cardápio"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl gradient-primary text-primary-foreground shadow-soft active:scale-95 transition-transform"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        );
      })()}

      {/* Alerta de Pré-pedidos */}
      {data.preOrdersCount > 0 && (
        <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-100 p-4 shadow-float">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-500 text-white animate-pulse">
              <Moon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-700">🚨 Atenção</div>
              <p className="mt-1 text-sm font-bold text-amber-900">
                Você tem {data.preOrdersCount} {data.preOrdersCount === 1 ? "pré-pedido acumulado" : "pré-pedidos acumulados"} feito{data.preOrdersCount === 1 ? "" : "s"} fora do horário de funcionamento!
              </p>
              <p className="mt-0.5 text-xs text-amber-800">Abra o sistema e despache para os entregadores.</p>
              <Link
                to="/pedidos"
                search={{ preOrder: true } as any}
                className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-600 px-4 py-1.5 text-xs font-black text-white shadow-soft hover:bg-amber-700"
              >
                Ver pré-pedidos →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* CTA Novo Pedido */}
      <button
        onClick={() => setShowNovo(true)}
        className="flex w-full items-center gap-3 rounded-2xl gradient-primary p-4 text-primary-foreground shadow-float transition-transform active:scale-[0.98]"
      >
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-foreground/20">
          <Plus className="h-6 w-6" strokeWidth={3} />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-black">+ Novo pedido</div>
          <div className="text-xs opacity-90">Venda balcão · PIX, Cartão ou Dinheiro</div>
        </div>
      </button>


      {isFree && trialDays > 0 && (
        <Link to="/plano" className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-primary/20">
          <Sparkles className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">Teste Pro grátis</div>
            <div className="text-xs text-muted-foreground">{trialDays} {trialDays === 1 ? "dia restante" : "dias restantes"}</div>
          </div>
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">Ver</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="card-float p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><TrendingUp className="h-4 w-4" /> Hoje</div>
          <div className="mt-2 text-2xl font-black tracking-tight">{formatBRL(data.receitaHoje)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{data.totalHoje} pedidos</div>
        </div>
        <div className="card-float p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Package className="h-4 w-4" /> Este mês</div>
          <div className="mt-2 text-2xl font-black tracking-tight">{data.totalMes}</div>
          {isFree ? (
            <div className="mt-1">
              <div className="h-1.5 w-full rounded-full bg-secondary">
                <div className="h-full rounded-full gradient-primary" style={{ width: `${usoPct}%` }} />
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">{data.totalMes}/{data.limiteFree} do plano Free</div>
            </div>
          ) : <div className="mt-1 text-xs text-muted-foreground">pedidos ilimitados</div>}
        </div>
      </div>

      {data.estoqueBaixo.length > 0 && (
        <div className="rounded-2xl border border-status-preparing/30 bg-status-preparing-bg p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-status-preparing">
            <AlertTriangle className="h-4 w-4" /> Estoque baixo
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {data.estoqueBaixo.map((p: any) => (
              <li key={p.id} className="flex justify-between"><span>{p.nome}</span><span className="font-bold">{p.estoque} un</span></li>
            ))}
          </ul>
          <Link to="/estoque" className="mt-3 inline-block text-xs font-semibold text-status-preparing underline">Repor estoque →</Link>
        </div>
      )}

      <div className="card-float">
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="text-base font-bold">Pedidos ativos</h2>
          <Link to="/pedidos" className="text-xs font-semibold text-primary">Ver todos</Link>
        </div>
        {data.pedidosAtivos.length === 0 ? (
          <div className="px-4 pb-5 text-sm text-muted-foreground">Nenhum pedido ativo. Toque em <b>+ Novo pedido</b> para começar 💧</div>
        ) : (
          <ul className="divide-y divide-border">
            {data.pedidosAtivos.map((p: any) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-4 hover:bg-secondary/40">
                <div className="min-w-0 flex-1">
                  {p.cliente?.id ? (
                    <button
                      type="button"
                      onClick={() => setSelectedCliente(p.cliente.id)}
                      className="truncate text-sm font-semibold text-primary hover:underline text-left"
                    >
                      {p.cliente?.nome ?? "Cliente"}
                    </button>
                  ) : (
                    <div className="truncate text-sm font-semibold">{p.cliente?.nome ?? "Cliente"}</div>
                  )}
                  <Link to="/pedidos/$id" params={{ id: p.id }} className="block text-xs text-muted-foreground hover:underline">
                    {formatBRL(p.total)} · Ver pedido →
                  </Link>
                </div>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <NovoPedidoModal open={showNovo} onClose={() => setShowNovo(false)} />
      <ClienteProfileSheet
        clienteId={selectedCliente}
        open={!!selectedCliente}
        onOpenChange={(o) => !o && setSelectedCliente(null)}
      />
    </div>
  );
}


import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { CheckCircle2, Clock, Truck, Package, Copy, Loader2, Droplet, MessageCircle, ChefHat } from "lucide-react";
import { getPedidoPublico } from "@/lib/loja.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/pedido/$id")({
  head: () => ({
    meta: [
      { title: "Acompanhar pedido — Pedirápido" },
      { name: "description", content: "Acompanhe seu pedido em tempo real." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PedidoTrack,
});

const STEPS = [
  { key: "pendente", label: "Recebido", icon: Package },
  { key: "preparo", label: "Preparando", icon: ChefHat },
  { key: "rota", label: "Em rota", icon: Truck },
  { key: "entregue", label: "Entregue", icon: CheckCircle2 },
];

const STATUS_INDEX: Record<string, number> = {
  pendente: 0, pago: 1, preparo: 1, rota: 2, entregue: 3, cancelado: -1,
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PedidoTrack() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getPedidoPublico);
  const { data, isLoading, error } = useQuery({
    queryKey: ["pedido-publico", id],
    queryFn: () => getFn({ data: { id } }),
    refetchInterval: 20000, // fallback polling
  });

  // Realtime: escuta mudanças no pedido específico
  useEffect(() => {
    const channel = supabase
      .channel(`pedido-tracking-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos", filter: `id=eq.${id}` },
        () => { qc.invalidateQueries({ queryKey: ["pedido-publico", id] }); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id, qc]);

  if (isLoading) {
    return <div className="min-h-screen grid place-items-center bg-[#F7F9FC]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (error || !data) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#F7F9FC] p-6 text-center">
        <p className="text-sm font-bold">Pedido não encontrado</p>
      </div>
    );
  }

  const p = data as unknown as {
    id: string;
    status: string;
    subtotal: number; taxa_entrega: number; total: number;
    distribuidora?: { nome: string; tempo_estimado_min?: number; telefone?: string | null; logo_url?: string | null };
    entregador?: { nome: string; veiculo_modelo: string | null; veiculo_placa: string | null } | null;
    codigo_pix?: string | null;
    itens?: Array<{ quantidade: number; subtotal: number; produto?: { nome: string } }>;
  };
  const currentIdx = STATUS_INDEX[p.status] ?? 0;
  const cancelado = p.status === "cancelado";
  const dist = p.distribuidora;

  const whatsappHref = dist?.telefone
    ? `https://wa.me/${String(dist.telefone).replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Preciso de ajuda com o pedido #${String(p.id).slice(0, 6)}`)}`
    : null;

  return (
    <div className="min-h-screen bg-[#F7F9FC] pb-10">
      <header className="bg-white border-b border-border">
        <div className="mx-auto max-w-lg px-4 py-4 flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white shadow-soft overflow-hidden aspect-square">
            {dist?.logo_url ? (
              <img src={dist.logo_url} alt={(dist as any).nome_fantasia ?? dist.nome} className="h-full w-full object-contain" />
            ) : (
              <div className="grid h-full w-full place-items-center gradient-primary text-primary-foreground">
                <Droplet className="h-5 w-5" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Pedido em</p>
            <p className="truncate text-sm font-black">{(dist as any)?.nome_fantasia ?? dist?.nome}</p>
          </div>
          <p className="text-xs text-muted-foreground">#{String(p.id).slice(0, 6)}</p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4 space-y-4">
        {/* Stepper animado */}
        <div className="rounded-3xl bg-white p-5 shadow-soft">
          {cancelado ? (
            <div className="text-center py-4">
              <p className="text-sm font-black text-red-600">Pedido cancelado</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between relative">
                <div className="absolute top-5 left-5 right-5 h-1 bg-secondary rounded-full" />
                <div
                  className="absolute top-5 left-5 h-1 gradient-primary rounded-full transition-all duration-700 ease-out"
                  style={{ width: `calc(${(Math.max(currentIdx, 0) / (STEPS.length - 1)) * 100}% - ${(Math.max(currentIdx, 0) / (STEPS.length - 1)) * 20}px)` }}
                />
                {STEPS.map((s, i) => {
                  const Icon = s.icon;
                  const done = i <= currentIdx;
                  const current = i === currentIdx;
                  return (
                    <div key={s.key} className="relative z-10 flex flex-col items-center gap-1">
                      <div className={cn(
                        "grid h-10 w-10 place-items-center rounded-full border-2 transition-all duration-500",
                        done ? "gradient-primary text-primary-foreground border-transparent shadow-soft" : "bg-white border-border text-muted-foreground",
                        current && "ring-4 ring-primary/20 animate-pulse",
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className={cn("text-[10px] font-bold", done ? "text-primary" : "text-muted-foreground")}>{s.label}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Estimativa: ~{dist?.tempo_estimado_min ?? 45} min
              </p>
            </>
          )}
        </div>

        {/* Card do entregador (Em Rota) */}
        {p.status === "rota" && p.entregador && (
          <div className="rounded-3xl bg-white p-5 shadow-soft border-2 border-primary/20 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl gradient-primary text-primary-foreground">
                <Truck className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-primary">Seu pedido saiu para entrega</p>
                <p className="mt-0.5 text-base font-black truncate">{p.entregador.nome}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.entregador.veiculo_modelo ?? "Moto"} · <span className="font-bold uppercase">{p.entregador.veiculo_placa ?? "—"}</span>
                </p>
              </div>
            </div>
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 text-sm font-black text-white shadow-soft"
              >
                <MessageCircle className="h-4 w-4" /> Falar com o suporte
              </a>
            )}
          </div>
        )}

        {p.codigo_pix && p.status === "pendente" && (
          <div className="rounded-2xl bg-white p-4 shadow-soft space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-primary">Pague com PIX</p>
            <p className="text-[10px] break-all font-mono bg-secondary p-2 rounded-xl">{p.codigo_pix}</p>
            <button
              onClick={() => { navigator.clipboard.writeText(String(p.codigo_pix)); toast.success("Código copiado"); }}
              className="w-full rounded-2xl h-11 gradient-primary text-primary-foreground font-black flex items-center justify-center gap-2"
            >
              <Copy className="h-4 w-4" /> Copiar código
            </button>
          </div>
        )}

        <div className="rounded-2xl bg-white p-4 shadow-soft">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Itens</p>
          <ul className="space-y-1">
            {(p.itens ?? []).map((it, idx) => (
              <li key={idx} className="flex justify-between text-sm">
                <span>{it.quantidade}x {it.produto?.nome}</span>
                <span className="font-bold">{fmt(Number(it.subtotal))}</span>
              </li>
            ))}
          </ul>
          <div className="border-t mt-3 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmt(Number(p.subtotal))}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Taxa de entrega</span><span>{fmt(Number(p.taxa_entrega))}</span></div>
            <div className="flex justify-between text-base font-black"><span>Total</span><span className="text-primary">{fmt(Number(p.total))}</span></div>
          </div>
        </div>

        {/* Suporte também disponível fora de rota */}
        {whatsappHref && p.status !== "rota" && p.status !== "entregue" && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 text-sm font-black text-white shadow-soft"
          >
            <MessageCircle className="h-4 w-4" /> Falar com a loja no WhatsApp
          </a>
        )}
      </main>
    </div>
  );
}

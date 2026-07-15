import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPedido, updatePedidoStatus, assignEntregador, listEntregadores } from "@/lib/aquaflow.functions";
import { formatBRL, formatPhone } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Copy, CheckCircle2, MapPin, Phone, Bike } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pedidos/$id")({
  component: PedidoDetail,
});

const FORMA_LABEL: Record<string, string> = { pix: "PIX", cartao: "Cartão na entrega", dinheiro: "Dinheiro" };

function PedidoDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: pedido, isLoading } = useQuery({ queryKey: ["pedido", id], queryFn: () => getPedido({ data: { id } }) });
  const { data: entregadores = [] } = useQuery({ queryKey: ["entregadores"], queryFn: () => listEntregadores() });

  const mut = useMutation({
    mutationFn: (status: string) => updatePedidoStatus({ data: { id, status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedido", id] });
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["entregas"] });
    },
  });

  const assign = useMutation({
    mutationFn: (entregadorId: string | null) => assignEntregador({ data: { pedidoId: id, entregadorId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pedido", id] }); toast.success("Entregador atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !pedido) return <div className="p-4 text-sm text-muted-foreground">Carregando…</div>;

  const p: any = pedido;
  const copyPix = () => { if (p.codigo_pix) { navigator.clipboard.writeText(p.codigo_pix); toast.success("PIX copiado!"); } };

  return (
    <div className="p-4 pb-8">
      <div className="flex items-center justify-between gap-2 pt-2">
        <Link to="/pedidos" className="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-soft"><ArrowLeft className="h-5 w-5" /></Link>
        <StatusBadge status={p.status} />
      </div>

      <div className="mt-4">
        <h1 className="text-2xl font-black tracking-tight">{formatBRL(p.total)}</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Pedido #{p.id.slice(0, 8)}</span>
          <span>·</span>
          <span className="font-bold text-primary">{FORMA_LABEL[p.forma_pagamento] ?? "PIX"}</span>
        </div>
      </div>

      <div className="card-float mt-4 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cliente</h2>
        <p className="mt-2 text-base font-bold">{p.cliente.nome}</p>
        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> {formatPhone(p.cliente.telefone)}</div>
          {p.cliente.endereco && <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {p.cliente.endereco}</div>}
        </div>
      </div>

      {/* Entregador */}
      <div className="card-float mt-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Entregador</h2>
          <Link to="/entregadores" className="text-xs font-semibold text-primary">Gerenciar</Link>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent"><Bike className="h-4 w-4 text-primary" /></div>
          <select
            value={p.entregador_id ?? ""}
            onChange={(e) => assign.mutate(e.target.value || null)}
            className="input flex-1"
          >
            <option value="">— Não atribuído —</option>
            {(entregadores as any[]).map((en) => (
              <option key={en.id} value={en.id} disabled={en.status === "inativo"}>
                {en.nome}{en.veiculo_placa ? ` · ${en.veiculo_placa}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card-float mt-3 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Itens</h2>
        <ul className="mt-2 divide-y divide-border">
          {p.itens.map((it: any) => (
            <li key={it.id} className="flex justify-between py-2 text-sm">
              <span>{it.quantidade}× {it.produto?.nome}</span>
              <span className="font-semibold">{formatBRL(it.subtotal)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 border-t border-border pt-2 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatBRL(p.subtotal)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Entrega</span><span>{formatBRL(p.taxa_entrega)}</span></div>
          <div className="mt-1 flex justify-between text-base font-black"><span>Total</span><span className="text-primary">{formatBRL(p.total)}</span></div>
        </div>
        {p.observacoes && (
          <div className="mt-3 rounded-xl bg-secondary/60 p-3 text-xs">
            <div className="font-bold text-muted-foreground">Observação</div>
            <div className="mt-0.5">{p.observacoes}</div>
          </div>
        )}
      </div>

      {p.codigo_pix && p.status === "pendente" && (
        <div className="mt-3 rounded-2xl border-2 border-dashed border-primary/40 bg-accent p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-primary">PIX Copia e Cola</h2>
          <div className="mt-2 break-all rounded-xl bg-background p-3 font-mono text-[11px] leading-relaxed">{p.codigo_pix}</div>
          <button onClick={copyPix} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow-soft">
            <Copy className="h-4 w-4" /> Copiar código PIX
          </button>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {p.status === "pendente" && (
          <>
            <button onClick={() => mut.mutate("pago")} className="flex w-full items-center justify-center gap-2 rounded-full bg-status-paid py-3.5 text-sm font-bold text-white shadow-float">
              <CheckCircle2 className="h-5 w-5" /> Confirmar pagamento
            </button>
            <button onClick={() => mut.mutate("preparo")} className="w-full rounded-full bg-status-preparing py-3 text-sm font-bold text-white shadow-soft">Marcar em preparo</button>
          </>
        )}
        {p.status === "preparo" && (
          <button onClick={() => mut.mutate("pago")} className="w-full rounded-full bg-status-paid py-3.5 text-sm font-bold text-white shadow-float">Marcar como pago</button>
        )}
        {p.status === "pago" && (
          <button onClick={() => { mut.mutate("rota"); navigate({ to: "/entregador" }); }} className="w-full rounded-full gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-float">
            Enviar para rota
          </button>
        )}
        {p.status === "rota" && (
          <button onClick={() => mut.mutate("entregue")} className="w-full rounded-full bg-status-paid py-3.5 text-sm font-bold text-white shadow-float">Marcar como entregue</button>
        )}
        {p.status !== "cancelado" && p.status !== "entregue" && (
          <button onClick={() => mut.mutate("cancelado")} className="w-full rounded-full bg-secondary py-3 text-sm font-semibold text-muted-foreground">Cancelar pedido</button>
        )}
      </div>
    </div>
  );
}

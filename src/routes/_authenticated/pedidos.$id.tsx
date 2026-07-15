import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPedido, updatePedidoStatus } from "@/lib/aquaflow.functions";
import { formatBRL, formatPhone } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Copy, CheckCircle2, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pedidos/$id")({
  component: PedidoDetail,
});

function PedidoDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: pedido, isLoading } = useQuery({
    queryKey: ["pedido", id],
    queryFn: () => getPedido({ data: { id } }),
  });

  const mut = useMutation({
    mutationFn: (status: string) => updatePedidoStatus({ data: { id, status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedido", id] });
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["entregas"] });
    },
  });

  if (isLoading || !pedido) return <div className="p-4 text-sm text-muted-foreground">Carregando…</div>;

  const copyPix = () => {
    if (!pedido.codigo_pix) return;
    navigator.clipboard.writeText(pedido.codigo_pix);
    toast.success("PIX copiado!");
  };

  return (
    <div className="p-4 pb-8">
      <div className="flex items-center justify-between gap-2 pt-2">
        <Link to="/pedidos" className="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-soft">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <StatusBadge status={pedido.status} />
      </div>

      <div className="mt-4">
        <h1 className="text-2xl font-black tracking-tight">{formatBRL(pedido.total)}</h1>
        <p className="text-xs text-muted-foreground">Pedido #{pedido.id.slice(0, 8)}</p>
      </div>

      {/* Cliente */}
      <div className="card-float mt-4 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cliente</h2>
        <p className="mt-2 text-base font-bold">{pedido.cliente.nome}</p>
        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> {formatPhone(pedido.cliente.telefone)}</div>
          {pedido.cliente.endereco && (
            <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {pedido.cliente.endereco}</div>
          )}
        </div>
      </div>

      {/* Itens */}
      <div className="card-float mt-3 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Itens</h2>
        <ul className="mt-2 divide-y divide-border">
          {pedido.itens.map((it) => (
            <li key={it.id} className="flex justify-between py-2 text-sm">
              <span>{it.quantidade}× {it.produto?.nome}</span>
              <span className="font-semibold">{formatBRL(it.subtotal)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 border-t border-border pt-2 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatBRL(pedido.subtotal)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Entrega</span><span>{formatBRL(pedido.taxa_entrega)}</span></div>
          <div className="mt-1 flex justify-between text-base font-black"><span>Total</span><span className="text-primary">{formatBRL(pedido.total)}</span></div>
        </div>
      </div>

      {/* PIX */}
      {pedido.codigo_pix && pedido.status === "pendente" && (
        <div className="mt-3 rounded-2xl border-2 border-dashed border-primary/40 bg-accent p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-primary">PIX Copia e Cola</h2>
          <div className="mt-2 break-all rounded-xl bg-background p-3 font-mono text-[11px] leading-relaxed">
            {pedido.codigo_pix}
          </div>
          <button
            onClick={copyPix}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow-soft"
          >
            <Copy className="h-4 w-4" /> Copiar código PIX
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 space-y-2">
        {pedido.status === "pendente" && (
          <>
            <button
              onClick={() => mut.mutate("pago")}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-status-paid py-3.5 text-sm font-bold text-white shadow-float"
            >
              <CheckCircle2 className="h-5 w-5" /> Simular pagamento confirmado
            </button>
            <button
              onClick={() => mut.mutate("preparo")}
              className="w-full rounded-full bg-status-preparing py-3 text-sm font-bold text-white shadow-soft"
            >
              Marcar em preparo
            </button>
          </>
        )}
        {pedido.status === "preparo" && (
          <button
            onClick={() => mut.mutate("pago")}
            className="w-full rounded-full bg-status-paid py-3.5 text-sm font-bold text-white shadow-float"
          >
            Marcar como pago
          </button>
        )}
        {pedido.status === "pago" && (
          <button
            onClick={() => { mut.mutate("rota"); navigate({ to: "/entregador" }); }}
            className="w-full rounded-full gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-float"
          >
            Enviar para rota
          </button>
        )}
        {pedido.status === "rota" && (
          <button
            onClick={() => mut.mutate("entregue")}
            className="w-full rounded-full bg-status-paid py-3.5 text-sm font-bold text-white shadow-float"
          >
            Marcar como entregue
          </button>
        )}
        {pedido.status !== "cancelado" && pedido.status !== "entregue" && (
          <button
            onClick={() => mut.mutate("cancelado")}
            className="w-full rounded-full bg-secondary py-3 text-sm font-semibold text-muted-foreground"
          >
            Cancelar pedido
          </button>
        )}
      </div>
    </div>
  );
}

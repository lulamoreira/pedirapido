import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listEntregas, updatePedidoStatus, getMeuEntregador, claimEntregador } from "@/lib/aquaflow.functions";
import { formatBRL, formatPhone } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, MapPin, Phone, Truck, CheckCircle2, Bike, LinkIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/entregador")({
  component: EntregadorPage,
});

function EntregadorPage() {
  const qc = useQueryClient();
  const { data: meu, isLoading: loadingMeu } = useQuery({ queryKey: ["meu-entregador"], queryFn: () => getMeuEntregador() });
  const { data = [], isLoading } = useQuery({ queryKey: ["entregas"], queryFn: () => listEntregas(), refetchInterval: 15_000, enabled: !!meu });
  const mut = useMutation({
    mutationFn: (v: { id: string; status: string }) => updatePedidoStatus({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["entregas"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Entrega confirmada!"); },
  });
  const [tel, setTel] = useState("");
  const claim = useMutation({
    mutationFn: () => claimEntregador({ data: { telefone: tel } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meu-entregador"] }); toast.success("Conta vinculada!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 pb-8">
      <div className="flex items-center gap-3 pt-2">
        <Link to="/dashboard" className="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-soft">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-black">Minhas entregas</h1>
          <p className="text-xs text-muted-foreground">
            {meu ? `${meu.nome}${meu.veiculo_placa ? " · " + meu.veiculo_placa : ""} · ${data.length} na fila` : "Vincule sua conta"}
          </p>
        </div>
      </div>

      {loadingMeu && <div className="mt-6 text-sm text-muted-foreground">Carregando…</div>}

      {!loadingMeu && !meu && (
        <div className="card-float mt-6 p-5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent"><Bike className="h-6 w-6 text-primary" /></div>
          <h2 className="mt-3 text-base font-black">Vincular conta de entregador</h2>
          <p className="mt-1 text-xs text-muted-foreground">Informe o telefone cadastrado pela distribuidora para receber suas entregas.</p>
          <form
            onSubmit={(e) => { e.preventDefault(); if (tel.replace(/\D/g, "").length >= 8) claim.mutate(); else toast.error("Telefone inválido"); }}
            className="mt-3 flex gap-2"
          >
            <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="(11) 99999-9999" className="input flex-1" />
            <button type="submit" disabled={claim.isPending} className="flex items-center gap-1 rounded-full gradient-primary px-4 text-sm font-bold text-primary-foreground shadow-float disabled:opacity-50">
              <LinkIcon className="h-4 w-4" /> {claim.isPending ? "…" : "Vincular"}
            </button>
          </form>
        </div>
      )}

      {meu && isLoading && <div className="mt-6 text-sm text-muted-foreground">Carregando entregas…</div>}

      <div className="mt-4 space-y-3">
        {data.map((p) => (
          <div key={p.id} className="card-float p-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-black text-primary">{formatBRL(p.total)}</div>
              <StatusBadge status={p.status} />
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="font-bold">{p.cliente?.nome}</div>
              {p.cliente?.endereco && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.cliente.endereco)}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-start gap-2 text-muted-foreground underline"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {p.cliente.endereco}
                </a>
              )}
              {p.cliente?.telefone && (
                <a href={`tel:${p.cliente.telefone}`} className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" /> {formatPhone(p.cliente.telefone)}
                </a>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              {p.status === "pago" && (
                <button onClick={() => mut.mutate({ id: p.id, status: "rota" })} className="flex flex-1 items-center justify-center gap-2 rounded-full gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-float">
                  <Truck className="h-4 w-4" /> Sair para entrega
                </button>
              )}
              {p.status === "rota" && (
                <button onClick={() => mut.mutate({ id: p.id, status: "entregue" })} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-status-paid py-3 text-sm font-bold text-white shadow-float">
                  <CheckCircle2 className="h-4 w-4" /> Entregue
                </button>
              )}
            </div>
          </div>
        ))}
        {!isLoading && data.length === 0 && (
          <div className="card-float p-8 text-center text-sm text-muted-foreground">Nenhuma entrega na fila. 🎉</div>
        )}
      </div>
    </div>
  );
}

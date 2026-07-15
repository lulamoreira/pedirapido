import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listPedidos } from "@/lib/aquaflow.functions";
import { formatBRL } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { ArrowLeft, Search } from "lucide-react";

const FILTROS = [
  { v: "todos", l: "Todos" },
  { v: "pendente", l: "Pendentes" },
  { v: "preparo", l: "Preparo" },
  { v: "pago", l: "Pagos" },
  { v: "rota", l: "Em rota" },
  { v: "entregue", l: "Entregues" },
] as const;

export const Route = createFileRoute("/_authenticated/pedidos")({
  validateSearch: (s: Record<string, unknown>) => ({
    preOrder: s.preOrder === true || s.preOrder === "true" ? true : undefined,
  }),
  component: PedidosList,
});

function PedidosList() {
  const { preOrder } = Route.useSearch();
  const [filtro, setFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["pedidos", filtro, preOrder],
    queryFn: () => listPedidos({ data: { status: filtro, preOrder } }),
  });

  const filtrados = data.filter((p) => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return p.cliente?.nome?.toLowerCase().includes(q) || p.cliente?.telefone?.includes(busca);
  });


  return (
    <div className="p-4">
      <div className="flex items-center gap-3 pt-2">
        <Link to="/dashboard" className="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-soft">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-black">{preOrder ? "Pré-pedidos" : "Pedidos"}</h1>
      </div>

      {preOrder && (
        <Link to="/pedidos" className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-bold">
          🌙 Filtrando pré-pedidos · Limpar filtro ✕
        </Link>
      )}

      <div className="relative mt-4">

        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou telefone…"
          className="w-full rounded-full border border-input bg-card px-11 py-3 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-1">
        <div className="flex gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.v}
              onClick={() => setFiltro(f.v)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition",
                filtro === f.v ? "bg-primary text-primary-foreground shadow-soft" : "bg-card text-foreground shadow-soft",
              )}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
        {!isLoading && filtrados.length === 0 && (
          <div className="card-float p-8 text-center text-sm text-muted-foreground">Nenhum pedido encontrado.</div>
        )}
        {filtrados.map((p) => (
          <Link
            key={p.id}
            to="/pedidos/$id"
            params={{ id: p.id }}
            className="card-float flex items-center justify-between gap-3 p-4 transition hover:scale-[1.01]"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{p.cliente?.nome ?? "Cliente"}</div>
              <div className="truncate text-xs text-muted-foreground">{p.cliente?.endereco ?? p.cliente?.telefone ?? "—"}</div>
              <div className="mt-1 text-sm font-black text-primary">{formatBRL(p.total)}</div>
            </div>
            <StatusBadge status={p.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}

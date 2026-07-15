import { createFileRoute } from "@tanstack/react-router";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Search, Users, Phone, MapPin, Package, Plus } from "lucide-react";
import { listClientes } from "@/lib/aquaflow.functions";
import { BottomNav } from "@/components/BottomNav";
import { NovoClienteModal } from "@/components/NovoClienteModal";
import { ClienteProfileSheet } from "@/components/ClienteProfileSheet";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/_authenticated/clientes")({
  component: ClientesPage,
});


function formatPhone(t: string | null | undefined) {
  if (!t) return "—";
  const d = t.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t;
}

function ClientesPage() {
  const [search, setSearch] = useState("");
  const [openNovo, setOpenNovo] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null);


  const { data = [], isLoading } = useQuery({
    queryKey: ["clientes", search],
    queryFn: () => listClientes({ data: { search } }),
  });

  const total = useMemo(() => data.length, [data]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl gradient-primary text-primary-foreground shadow-soft">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-black tracking-tight">Meus clientes</h1>
              <p className="text-xs text-muted-foreground">{total} {total === 1 ? "cliente cadastrado" : "clientes cadastrados"}</p>
            </div>
            <Button
              onClick={() => setOpenNovo(true)}
              className="rounded-full h-11 px-4 gradient-primary text-primary-foreground font-black shadow-soft shrink-0"
            >
              <Plus className="h-4 w-4 mr-1" /> Novo
            </Button>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-secondary px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou telefone"
              className="h-11 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4">
        {isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : data.length === 0 ? (
          <div className="rounded-3xl bg-card p-8 text-center shadow-soft">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-bold">Nenhum cliente ainda</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Novos clientes são cadastrados automaticamente quando um pedido é criado no PDV ou recebido pelo WhatsApp.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.map((c: any) => (
              <li key={c.id} className="rounded-2xl bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setSelectedCliente(c.id)}
                      className="truncate text-sm font-black text-left text-primary hover:underline"
                    >
                      {c.nome}
                    </button>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" /> {formatPhone(c.telefone)}
                    </p>
                    {c.endereco && (
                      <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="line-clamp-2">{c.endereco}</span>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCliente(c.id)}
                    className="shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-center hover:bg-primary/20 transition"
                  >
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                      <Package className="h-3 w-3" /> pedidos
                    </div>
                    <div className="text-lg font-black text-primary">{c.total_pedidos}</div>
                  </button>
                </div>
              </li>
            ))}

          </ul>
        )}
      </main>

      <BottomNav />
      <NovoClienteModal open={openNovo} onOpenChange={setOpenNovo} />

    </div>
  );
}

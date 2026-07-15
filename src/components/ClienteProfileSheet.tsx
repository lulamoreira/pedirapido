import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { getClienteHistorico } from "@/lib/aquaflow.functions";
import { Phone, MapPin, Package, Bike, Moon } from "lucide-react";

type Props = {
  clienteId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatItem(it: any) {
  const p = it.produto || {};
  const parts = [p.nome];
  if (p.volume_valor && p.volume_unidade) parts.push(`${p.volume_valor}${p.volume_unidade}`);
  if (p.marca) parts.push(String(p.marca).toUpperCase());
  return `${it.quantidade}x ${parts.filter(Boolean).join(" • ")}`;
}

export function ClienteProfileSheet({ clienteId, open, onOpenChange }: Props) {
  const fetchHist = useServerFn(getClienteHistorico);
  const { data, isLoading } = useQuery({
    queryKey: ["cliente-historico", clienteId],
    queryFn: () => fetchHist({ data: { clienteId: clienteId! } }),
    enabled: !!clienteId && open,
  });

  const cliente = data?.cliente;
  const pedidos = data?.pedidos ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <SheetHeader className="p-5 border-b bg-gradient-to-br from-primary/10 to-transparent">
          <SheetTitle className="text-xl">Perfil do Cliente</SheetTitle>
        </SheetHeader>

        {isLoading && <div className="p-6 text-sm text-muted-foreground">Carregando…</div>}

        {cliente && (
          <div className="p-5 space-y-5">
            <div className="rounded-2xl border p-4 space-y-2 bg-card">
              <div className="font-bold text-lg">{cliente.nome}</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4" /> {cliente.telefone}
              </div>
              {cliente.endereco && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" /> <span>{cliente.endereco}</span>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" /> Histórico de Pedidos
                <span className="ml-auto text-xs text-muted-foreground">{pedidos.length} pedido(s)</span>
              </h3>

              {pedidos.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhum pedido encontrado para este cliente ainda.
                </div>
              ) : (
                <div className="space-y-3">
                  {pedidos.map((p: any) => (
                    <div key={p.id} className="rounded-2xl border p-4 bg-card space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-mono text-muted-foreground">
                          #{p.id.slice(0, 8).toUpperCase()}
                        </div>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {new Date(p.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                        <span className="font-bold text-primary">{brl(Number(p.total))}</span>
                      </div>
                      {p.is_pre_order && (
                        <div className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          <Moon className="w-3 h-3" /> Pré-pedido
                        </div>
                      )}
                      {p.itens && p.itens.length > 0 && (
                        <ul className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t">
                          {p.itens.map((it: any, i: number) => (
                            <li key={i}>{formatItem(it)}</li>
                          ))}
                        </ul>
                      )}
                      {p.entregador && (p.status === "entregue" || p.status === "rota") && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                          <Bike className="w-3.5 h-3.5" />
                          Entregue por: <span className="font-medium text-foreground">{p.entregador.nome}</span>
                          {p.entregador.veiculo_placa && (
                            <span className="text-muted-foreground">(Placa: {p.entregador.veiculo_placa})</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

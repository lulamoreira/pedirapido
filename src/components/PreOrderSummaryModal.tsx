import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listPreOrdersResumo } from "@/lib/aquaflow.functions";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Moon, ArrowRight } from "lucide-react";
import { formatBRL } from "@/lib/format";

const KEY = "pedirapido:preorder-summary-lastshown";

function volumeStr(v: any) {
  if (!v?.volume_valor) return "";
  return ` ${v.volume_valor}${v.volume_unidade ?? ""}`;
}

export function PreOrderSummaryModal({
  distribuidoraId,
  isOpen,
}: {
  distribuidoraId?: string;
  isOpen: boolean; // horário atual está aberto
}) {
  const fn = useServerFn(listPreOrdersResumo);
  const { data } = useQuery({
    queryKey: ["preorder-summary", distribuidoraId],
    queryFn: () => fn(),
    enabled: !!distribuidoraId && isOpen,
    staleTime: 60_000,
  });

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !data || data.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const last = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    if (last === today) return;
    setOpen(true);
    try { localStorage.setItem(KEY, today); } catch { /* ignore */ }
  }, [data, isOpen]);

  if (!data || data.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden rounded-3xl">
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/25">
              <Moon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider opacity-90">Bom dia! ☀️</p>
              <h2 className="text-lg font-black leading-tight">
                Você tem {data.length} pré-pedido{data.length > 1 ? "s" : ""} aguardando
              </h2>
            </div>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-4 space-y-2 bg-[#F7F9FC]">
          {data.slice(0, 8).map((p: any) => {
            const itens = (p.itens ?? [])
              .map((it: any) => `${it.quantidade}x ${it.produto?.nome ?? ""}${volumeStr(it.produto)}`)
              .join(", ");
            return (
              <div key={p.id} className="rounded-2xl bg-white p-3 shadow-soft">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-black uppercase">{p.cliente?.nome ?? "Cliente"}</p>
                  <span className="text-xs font-bold text-primary shrink-0">{formatBRL(Number(p.total))}</span>
                </div>
                {itens && <p className="mt-0.5 truncate text-xs text-muted-foreground">{itens}</p>}
              </div>
            );
          })}
          {data.length > 8 && (
            <p className="pt-1 text-center text-xs text-muted-foreground">
              + {data.length - 8} outro{data.length - 8 > 1 ? "s" : ""}…
            </p>
          )}
        </div>

        <div className="p-4 border-t bg-white flex gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-2xl flex-1">
            Depois
          </Button>
          <Button
            asChild
            className="rounded-2xl flex-1 gradient-primary font-black"
            onClick={() => setOpen(false)}
          >
            <Link to="/pedidos" search={{ preOrder: true } as any}>
              Ir para a fila <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

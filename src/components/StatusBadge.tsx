import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["pedido_status"];

const MAP: Record<Status, { label: string; className: string }> = {
  pendente: {
    label: "Pendente",
    className: "bg-status-pending-bg text-status-pending",
  },
  preparo: {
    label: "Em preparo",
    className: "bg-status-preparing-bg text-status-preparing",
  },
  pago: {
    label: "Pago",
    className: "bg-status-paid-bg text-status-paid",
  },
  rota: {
    label: "Em rota",
    className: "bg-status-paid-bg text-status-paid",
  },
  entregue: {
    label: "Entregue",
    className: "bg-status-done-bg text-status-done",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-destructive/10 text-destructive",
  },
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const s = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        s.className,
        className,
      )}
    >
      {s.label}
    </span>
  );
}

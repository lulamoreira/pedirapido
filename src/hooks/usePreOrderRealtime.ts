import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { playNewOrderChime } from "@/lib/notify-sound";

/**
 * Escuta INSERTs na tabela `pedidos` para a distribuidora atual e toca um som
 * quando chega um novo pré-pedido (is_pre_order = true).
 */
export function usePreOrderRealtime(distribuidoraId: string | undefined) {
  const qc = useQueryClient();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!distribuidoraId) return;

    const channel = supabase
      .channel(`pre-orders-${distribuidoraId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pedidos",
          filter: `distribuidora_id=eq.${distribuidoraId}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (!row?.is_pre_order) return;
          if (seen.current.has(row.id)) return;
          seen.current.add(row.id);
          try { playNewOrderChime(); } catch { /* audio bloqueado */ }
          toast("🚨 Novo pré-pedido!", {
            description: `Pedido de R$ ${Number(row.total ?? 0).toFixed(2)} aguardando na fila.`,
            duration: 8000,
          });
          qc.invalidateQueries({ queryKey: ["dashboard"] });
          qc.invalidateQueries({ queryKey: ["pedidos"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [distribuidoraId, qc]);
}

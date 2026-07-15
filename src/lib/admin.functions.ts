import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin_master" });
    if (!isAdmin) throw new Error("Acesso negado");

    const [{ data: dists }, { data: pedidos }] = await Promise.all([
      supabase.from("distribuidoras").select("*").order("created_at", { ascending: false }),
      supabase.from("pedidos").select("total,status,distribuidora_id,created_at"),
    ]);

    const PLANO_VALOR: Record<string, number> = { free: 0, pro: 79, business: 199 };
    const mrr = (dists ?? []).reduce((s, d) => s + (PLANO_VALOR[d.plano] ?? 0), 0);
    const gmv = (pedidos ?? []).filter(p => p.status !== "cancelado").reduce((s, p) => s + Number(p.total), 0);

    return {
      distribuidoras: dists ?? [],
      totalDistribuidoras: dists?.length ?? 0,
      totalPedidos: pedidos?.length ?? 0,
      mrr, gmv,
    };
  });

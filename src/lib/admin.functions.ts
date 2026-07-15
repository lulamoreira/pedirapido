import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MASTER_EMAILS = ["lula1973@gmail.com", "lula1973@gmail.com.br"];

export const getAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims?.email as string | undefined)?.toLowerCase();
    const bypass = !!email && MASTER_EMAILS.includes(email);
    let isAdmin = bypass;
    if (!isAdmin) {
      const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin_master" });
      isAdmin = !!data;
    }
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

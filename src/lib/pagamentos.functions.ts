import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getDistId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("distribuidoras")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!data?.id) throw new Error("Distribuidora não encontrada");
  return data.id as string;
}

function requireEnv() {
  const appId = process.env.MERCADOPAGO_APP_ID;
  const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET;
  const redirectUri = process.env.MERCADOPAGO_REDIRECT_URI;
  if (!appId || !clientSecret || !redirectUri) {
    throw new Error("Integração de pagamento não configurada pelo administrador.");
  }
  return { appId, clientSecret, redirectUri };
}

// GET — status da conexão (sem tokens)
export const getIntegracaoStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const distId = await getDistId(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("integracoes_pagamento")
      .select("mp_user_id, conectado_em, access_token")
      .eq("distribuidora_id", distId)
      .maybeSingle();
    const conectado = !!(data && data.access_token);
    return {
      conectado,
      mp_user_id: conectado ? (data!.mp_user_id ?? null) : null,
      conectado_em: conectado ? (data!.conectado_em ?? null) : null,
    };
  });

// POST — inicia OAuth
export const iniciarConexaoMercadoPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { appId, redirectUri } = requireEnv();
    const { supabase, userId } = context;
    const distId = await getDistId(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const state = crypto.randomUUID();
    const expira = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin.from("oauth_states").insert({
      state,
      distribuidora_id: distId,
      expira_em: expira,
    });
    if (error) throw new Error(error.message);

    const url =
      `https://auth.mercadopago.com.br/authorization` +
      `?client_id=${encodeURIComponent(appId)}` +
      `&response_type=code&platform_id=mp` +
      `&state=${encodeURIComponent(state)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;
    return { url };
  });

// POST — desconecta
export const desconectarMercadoPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const distId = await getDistId(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("integracoes_pagamento")
      .delete()
      .eq("distribuidora_id", distId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


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

// -------- Helpers internos (não são createServerFn) --------

export async function getValidMpToken(distribuidoraId: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("integracoes_pagamento")
      .select("access_token, refresh_token, token_expira_em")
      .eq("distribuidora_id", distribuidoraId)
      .maybeSingle();
    if (!row || !(row as any).access_token) return null;

    const expiraEm = (row as any).token_expira_em ? new Date((row as any).token_expira_em).getTime() : 0;
    const precisaRenovar = !expiraEm || expiraEm - Date.now() < 5 * 60 * 1000;

    if (!precisaRenovar) return (row as any).access_token as string;

    if (!(row as any).refresh_token) return (row as any).access_token as string;

    const appId = process.env.MERCADOPAGO_APP_ID;
    const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET;
    if (!appId || !clientSecret) return null;

    const resp = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: appId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: (row as any).refresh_token,
      }),
    });
    if (!resp.ok) {
      console.error("[MP] refresh_token falhou:", resp.status);
      return null;
    }
    const j = await resp.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!j.access_token) return null;

    const novaExp = new Date(Date.now() + Number(j.expires_in ?? 0) * 1000).toISOString();
    await supabaseAdmin
      .from("integracoes_pagamento")
      .update({
        access_token: j.access_token,
        refresh_token: j.refresh_token ?? (row as any).refresh_token,
        token_expira_em: novaExp,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("distribuidora_id", distribuidoraId);

    return j.access_token;
  } catch (err) {
    console.error("[MP] getValidMpToken erro");
    void err;
    return null;
  }
}

export async function criarPixMercadoPago(args: {
  token: string;
  valor: number;
  descricao: string;
  payerEmail: string;
  payerNome: string;
}): Promise<{ payment_id: string; copia_e_cola: string; qr_base64: string | null } | null> {
  try {
    const resp = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: Number(args.valor.toFixed(2)),
        description: args.descricao,
        payment_method_id: "pix",
        payer: { email: args.payerEmail, first_name: args.payerNome },
      }),
    });
    if (!resp.ok) {
      console.error("[MP] criar pix falhou:", resp.status);
      return null;
    }
    const j = await resp.json() as any;
    const qr = j?.point_of_interaction?.transaction_data?.qr_code;
    const qrB64 = j?.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
    if (!j?.id || !qr) return null;
    return { payment_id: String(j.id), copia_e_cola: String(qr), qr_base64: qrB64 ? String(qrB64) : null };
  } catch (err) {
    console.error("[MP] criarPixMercadoPago erro");
    void err;
    return null;
  }
}

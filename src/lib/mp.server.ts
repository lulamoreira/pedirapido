// Server-only helpers para integração Mercado Pago.
// Nunca importe este arquivo do lado cliente — o extension `.server.ts`
// bloqueia inclusão no bundle do navegador.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function getValidMpToken(distribuidoraId: string): Promise<string | null> {
  try {
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
    const j = (await resp.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
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

export async function criarPreferenceMercadoPago(args: {
  token: string;
  pedidoId: string;
  itens: Array<{ title: string; quantity: number; unit_price: number }>;
  taxaEntrega: number;
  payerNome: string;
  payerEmail: string;
  descricaoLoja: string;
}): Promise<{ init_point: string; preference_id: string } | null> {
  const BASE = "https://pedirapido.lovable.app";
  try {
    const items = args.itens.map((it) => ({
      title: it.title,
      quantity: it.quantity,
      unit_price: Number(it.unit_price.toFixed(2)),
      currency_id: "BRL",
    }));
    if (args.taxaEntrega > 0) {
      items.push({
        title: "Taxa de entrega",
        quantity: 1,
        unit_price: Number(args.taxaEntrega.toFixed(2)),
        currency_id: "BRL",
      });
    }

    const resp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        items,
        external_reference: args.pedidoId,
        payer: { name: args.payerNome, email: args.payerEmail },
        back_urls: {
          success: `${BASE}/pedido/${args.pedidoId}`,
          pending: `${BASE}/pedido/${args.pedidoId}`,
          failure: `${BASE}/pedido/${args.pedidoId}`,
        },
        auto_return: "approved",
        notification_url: `${BASE}/api/public/webhook/mercadopago`,
        statement_descriptor: args.descricaoLoja.slice(0, 22),
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.error("[MP] criar preference falhou:", resp.status, body);
      return null;
    }
    const j = (await resp.json()) as any;
    if (!j?.id || !j?.init_point) {
      console.error("[MP] preference sem init_point/id");
      return null;
    }
    return { init_point: String(j.init_point), preference_id: String(j.id) };
  } catch (err) {
    console.error("[MP] criarPreferenceMercadoPago erro");
    void err;
    return null;
  }
}

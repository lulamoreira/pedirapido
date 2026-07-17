import { createFileRoute } from "@tanstack/react-router";

function redirect(to: string) {
  return new Response(null, { status: 302, headers: { Location: to } });
}

export const Route = createFileRoute("/api/public/integracoes/mercadopago/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          if (!code || !state) return redirect("/configuracoes?mp=erro");

          const appId = process.env.MERCADOPAGO_APP_ID;
          const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET;
          const redirectUri = process.env.MERCADOPAGO_REDIRECT_URI;
          if (!appId || !clientSecret || !redirectUri) return redirect("/configuracoes?mp=erro");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Valida state
          const { data: st } = await supabaseAdmin
            .from("oauth_states")
            .select("distribuidora_id, expira_em")
            .eq("state", state)
            .maybeSingle();
          if (!st) return redirect("/configuracoes?mp=erro");
          if (new Date(st.expira_em).getTime() < Date.now()) {
            await supabaseAdmin.from("oauth_states").delete().eq("state", state);
            return redirect("/configuracoes?mp=erro");
          }

          // Troca code por tokens
          const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
            method: "POST",
            headers: { "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify({
              client_id: appId,
              client_secret: clientSecret,
              grant_type: "authorization_code",
              code,
              redirect_uri: redirectUri,
            }),
          });
          if (!tokenRes.ok) return redirect("/configuracoes?mp=erro");
          const tokens = (await tokenRes.json()) as {
            access_token?: string;
            refresh_token?: string;
            user_id?: number | string;
            expires_in?: number;
          };
          if (!tokens.access_token) return redirect("/configuracoes?mp=erro");

          const expiraEm = tokens.expires_in
            ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString()
            : null;

          const nowIso = new Date().toISOString();
          await supabaseAdmin
            .from("integracoes_pagamento")
            .upsert(
              {
                distribuidora_id: st.distribuidora_id,
                provedor: "mercadopago",
                mp_user_id: tokens.user_id != null ? String(tokens.user_id) : null,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token ?? null,
                token_expira_em: expiraEm,
                conectado_em: nowIso,
                updated_at: nowIso,
              },
              { onConflict: "distribuidora_id" },
            );

          await supabaseAdmin.from("oauth_states").delete().eq("state", state);
          return redirect("/configuracoes?mp=conectado");
        } catch {
          return redirect("/configuracoes?mp=erro");
        }
      },
    },
  },
});

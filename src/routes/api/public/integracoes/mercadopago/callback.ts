import { createFileRoute } from "@tanstack/react-router";

function redirect(to: string) {
  return new Response(null, { status: 302, headers: { Location: to } });
}

function err(reason: string) {
  return redirect(`/configuracoes?mp=erro&reason=${encodeURIComponent(reason)}`);
}

export const Route = createFileRoute("/api/public/integracoes/mercadopago/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          const providerError = url.searchParams.get("error");
          if (providerError) return err(providerError);
          if (!code || !state) return err("missing_code_or_state");

          const appId = process.env.MERCADOPAGO_APP_ID;
          const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET;
          const redirectUri = process.env.MERCADOPAGO_REDIRECT_URI;
          if (!appId || !clientSecret || !redirectUri) return err("config_missing");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Valida state
          const { data: st } = await supabaseAdmin
            .from("oauth_states")
            .select("distribuidora_id, expira_em")
            .eq("state", state)
            .maybeSingle();
          if (!st) return err("state_invalid");
          if (new Date(st.expira_em).getTime() < Date.now()) {
            await supabaseAdmin.from("oauth_states").delete().eq("state", state);
            return err("state_expired");
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
          if (!tokenRes.ok) {
            const txt = await tokenRes.text().catch(() => "");
            console.error("[MP OAuth] token exchange failed", tokenRes.status, txt);
            return err(`token_exchange_${tokenRes.status}`);
          }
          const tokens = (await tokenRes.json()) as {
            access_token?: string;
            refresh_token?: string;
            user_id?: number | string;
            expires_in?: number;
          };
          if (!tokens.access_token) return err("no_access_token");

          const expiraEm = tokens.expires_in
            ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString()
            : null;

          const nowIso = new Date().toISOString();
          const { error: upsertErr } = await supabaseAdmin
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
          if (upsertErr) {
            console.error("[MP OAuth] upsert failed", upsertErr);
            return err("save_failed");
          }

          await supabaseAdmin.from("oauth_states").delete().eq("state", state);
          return redirect("/configuracoes?mp=conectado");
        } catch (e) {
          console.error("[MP OAuth] unexpected", e);
          return err("unexpected");
        }
      },
    },
  },
});

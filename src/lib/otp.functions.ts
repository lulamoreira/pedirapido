import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomUUID } from "crypto";

function onlyDigits(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

function hashCode(codigo: string, telefoneDigits: string): string {
  return createHash("sha256").update(`${codigo}:${telefoneDigits}`).digest("hex");
}

function gerarCodigo6(): string {
  // 000000..999999 com padding
  const n = Math.floor(Math.random() * 1_000_000);
  return String(n).padStart(6, "0");
}

// ---------- requestOtp ----------
export const requestOtp = createServerFn({ method: "POST" })
  .inputValidator((d: { distribuidora_id: string; telefone: string }) =>
    z.object({
      distribuidora_id: z.string().uuid(),
      telefone: z.string().min(4).max(20),
    }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendWhatsApp } = await import("@/lib/whatsapp.server");

    const telefoneDigits = onlyDigits(data.telefone);
    if (telefoneDigits.length < 10) throw new Error("Telefone inválido.");

    const agora = Date.now();
    const umMinAtras = new Date(agora - 60 * 1000).toISOString();
    const umaHoraAtras = new Date(agora - 60 * 60 * 1000).toISOString();

    // Rate-limit: última 1h
    const { data: recentes, error: eRec } = await supabaseAdmin
      .from("otp_verificacoes" as any)
      .select("id,created_at")
      .eq("distribuidora_id", data.distribuidora_id)
      .eq("telefone", telefoneDigits)
      .gte("created_at", umaHoraAtras)
      .order("created_at", { ascending: false });
    if (eRec) throw eRec;

    const list = (recentes ?? []) as Array<{ id: string; created_at: string }>;
    if (list.length >= 5) {
      throw new Error("Muitas solicitações, tente mais tarde.");
    }
    if (list.length && list[0].created_at >= umMinAtras) {
      throw new Error("Aguarde um instante para reenviar.");
    }

    const codigo = gerarCodigo6();
    const codigo_hash = hashCode(codigo, telefoneDigits);
    const expira_em = new Date(agora + 5 * 60 * 1000).toISOString();

    const { error: eIns } = await supabaseAdmin
      .from("otp_verificacoes" as any)
      .insert({
        distribuidora_id: data.distribuidora_id,
        telefone: telefoneDigits,
        codigo_hash,
        expira_em,
        tentativas: 0,
        token: null,
        verificado_at: null,
      });
    if (eIns) throw eIns;

    const msg =
      `🔐 Seu código Pedirápido é: ${codigo}\n\n` +
      `Expira em 5 minutos. Não compartilhe com ninguém.`;
    const result = await sendWhatsApp(data.telefone, msg);

    return { ok: true, simulado: result.status === "simulado" };
  });

// ---------- verifyOtp ----------
export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((d: { distribuidora_id: string; telefone: string; codigo: string }) =>
    z.object({
      distribuidora_id: z.string().uuid(),
      telefone: z.string().min(4).max(20),
      codigo: z.string().min(4).max(10),
    }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const telefoneDigits = onlyDigits(data.telefone);
    const codigoDigits = onlyDigits(data.codigo);
    if (telefoneDigits.length < 10) throw new Error("Telefone inválido.");
    if (codigoDigits.length !== 6) throw new Error("Código inválido.");

    const agora = new Date().toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from("otp_verificacoes" as any)
      .select("id,codigo_hash,tentativas,expira_em,verificado_at")
      .eq("distribuidora_id", data.distribuidora_id)
      .eq("telefone", telefoneDigits)
      .is("verificado_at", null)
      .gt("expira_em", agora)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;

    const row = (rows ?? [])[0] as
      | { id: string; codigo_hash: string; tentativas: number; expira_em: string; verificado_at: string | null }
      | undefined;

    if (!row) throw new Error("Código expirado. Peça um novo.");
    if ((row.tentativas ?? 0) >= 5) throw new Error("Muitas tentativas. Peça um novo código.");

    await supabaseAdmin
      .from("otp_verificacoes" as any)
      .update({ tentativas: (row.tentativas ?? 0) + 1 })
      .eq("id", row.id);

    const hash = hashCode(codigoDigits, telefoneDigits);
    if (hash !== row.codigo_hash) throw new Error("Código incorreto.");

    const token = randomUUID();
    const { error: eUp } = await supabaseAdmin
      .from("otp_verificacoes" as any)
      .update({ verificado_at: new Date().toISOString(), token })
      .eq("id", row.id);
    if (eUp) throw eUp;

    return { ok: true, token };
  });

// ---------- helper server-side (usado pelo checkout) ----------
export async function assertTelefoneVerificado(args: {
  distribuidora_id: string;
  telefone: string;
  token?: string | null;
}): Promise<void> {
  if (!args.token) throw new Error("Telefone não verificado.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const telefoneDigits = onlyDigits(args.telefone);
  const trintaMinAtras = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("otp_verificacoes" as any)
    .select("id,verificado_at")
    .eq("distribuidora_id", args.distribuidora_id)
    .eq("telefone", telefoneDigits)
    .eq("token", args.token)
    .not("verificado_at", "is", null)
    .gte("verificado_at", trintaMinAtras)
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Telefone não verificado.");
}

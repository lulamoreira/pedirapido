// Envio de notificações WhatsApp (Evolution API). Se as envs não estiverem
// configuradas, funciona em modo "simulado" — a mensagem é registrada mesmo assim.
export type TipoNotificacao = "rota" | "entregue";

function normalizePhone(tel: string): string {
  const digits = (tel ?? "").replace(/\D/g, "");
  if (!digits) return "";
  // Adiciona código do Brasil se não presente
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function buildMensagem(
  tipo: TipoNotificacao,
  ctx: { clienteNome: string; entregadorNome?: string; veiculo?: string; placa?: string }
): string {
  const nome = ctx.clienteNome || "cliente";
  const ent = ctx.entregadorNome || "nosso entregador";
  if (tipo === "rota") {
    return (
      `Ótimas notícias, ${nome}! O seu pedido acabou de sair para a entrega! 🚀\n\n` +
      `🛵 Entregador: ${ent}\n` +
      `🏍️ Veículo: ${ctx.veiculo || "—"}\n` +
      `🔢 Placa: ${ctx.placa || "—"}\n\n` +
      `*Já vai preparando o espaço para o seu galão! Em poucos minutos nosso motoca estará aí na sua porta.*`
    );
  }
  return (
    `💧 Pedido Entregue com Sucesso!\n\n` +
    `Muito obrigado pela preferência, ${nome}. Esperamos que tenha gostado da velocidade do Pedirápido! ` +
    `Seus galões foram entregues pelo ${ent}. Quando precisar de mais, é só chamar! ✨`
  );
}

export async function sendWhatsApp(telefone: string, mensagem: string): Promise<{
  status: "enviado" | "falha" | "simulado";
  response: unknown;
}> {
  const url = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  const number = normalizePhone(telefone);
  if (!number) return { status: "falha", response: { error: "telefone inválido" } };

  if (!url || !apiKey || !instance) {
    // Modo simulado — não há provedor configurado
    return { status: "simulado", response: { simulated: true, to: number } };
  }
  try {
    const endpoint = `${url.replace(/\/$/, "")}/message/sendText/${instance}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number, text: mensagem }),
    });
    const body = await res.text();
    let parsed: unknown = body;
    try { parsed = JSON.parse(body); } catch { /* keep text */ }
    if (!res.ok) return { status: "falha", response: { status: res.status, body: parsed } };
    return { status: "enviado", response: parsed };
  } catch (e) {
    return { status: "falha", response: { error: (e as Error).message } };
  }
}

export async function notifyAndLog(
  supabase: any,
  args: {
    tipo: TipoNotificacao;
    pedidoId: string;
    distribuidoraId: string;
    telefone: string;
    clienteNome: string;
    entregadorNome?: string;
    veiculo?: string;
    placa?: string;
  }
) {
  const mensagem = buildMensagem(args.tipo, args);
  const result = await sendWhatsApp(args.telefone, mensagem);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("notificacoes_whatsapp").insert({
    distribuidora_id: args.distribuidoraId,
    pedido_id: args.pedidoId,
    tipo: args.tipo,
    telefone: args.telefone,
    mensagem,
    status: result.status,
    provider_response: result.response as any,
  });
}

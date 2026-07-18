import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeProperName, normalizeSentence } from "@/lib/text-normalize";

/** Hora atual no fuso America/Sao_Paulo. Retorna dia da semana (0=Dom..6=Sáb)
 *  e minutos desde a meia-noite, independentemente do TZ do servidor. */
function nowInSaoPaulo(): { dow: number; minutesNow: number; hhmm: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const wk = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = dowMap[wk] ?? 0;
  // Intl pode retornar "24" para meia-noite em hour12:false; normaliza.
  const hour = hh === 24 ? 0 : hh;
  return {
    dow,
    minutesNow: hour * 60 + mm,
    hhmm: `${String(hour).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
  };
}



// -------- Carregar loja pública (distribuidora + catálogo) --------
// Aceita slug (novo) ou UUID (legado) no mesmo parâmetro `id`.
export const getLojaPublica = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id);
    const cols = "id,slug,nome,nome_fantasia,razao_social,cnpj,telefone,plano,taxa_entrega_padrao,horario_abertura,horario_fechamento,tempo_estimado_min,status_assinatura,logo_url,logradouro,numero,complemento,bairro,cidade,uf,cep,verificacao_whatsapp";
    const { data: dist, error } = await supabaseAdmin
      .from("distribuidoras")
      .select(cols)
      .eq(isUuid ? "id" : "slug", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!dist) throw new Error("Loja não encontrada");

    const { data: prods } = await supabaseAdmin
      .from("produtos")
      .select("id,nome,descricao,preco,categoria,estoque,volume_valor,volume_unidade,marca,tipo_embalagem")
      .eq("distribuidora_id", dist.id)
      .eq("ativo", true)
      .order("categoria")
      .order("nome");

    // FREE/PRO: só categoria "agua". BUSINESS: tudo.
    const isBusiness = (dist as any).plano === "business";
    const produtos = (prods ?? []).filter((p: any) => isBusiness || p.categoria === "agua");

    // Horários por dia da semana (0=Dom)
    const { data: horarios } = await supabaseAdmin
      .from("horarios_funcionamento")
      .select("dia_semana,horario_abertura,horario_fechamento,is_fechado_o_dia_todo")
      .eq("distribuidora_id", dist.id);

    // Hora atual em America/Sao_Paulo (o worker roda em UTC)
    const { dow, minutesNow, hhmm } = nowInSaoPaulo();

    const toMin = (t: string) => {
      const [h, m] = t.slice(0, 5).split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const isBetween = (openStr: string, closeStr: string) => {
      const open = toMin(openStr);
      const close = toMin(closeStr);
      // Horário que vira o dia (ex.: 22:00 → 06:00)
      if (open >= close) return minutesNow >= open || minutesNow < close;
      return minutesNow >= open && minutesNow < close;
    };

    let aberto = false;
    let proximoDia: number | null = null;
    let proximoHorario: string | null = null;

    const hoje = (horarios ?? []).find((h: any) => h.dia_semana === dow);
    if (hoje && !hoje.is_fechado_o_dia_todo && hoje.horario_abertura && hoje.horario_fechamento) {
      aberto = isBetween(hoje.horario_abertura, hoje.horario_fechamento);
    } else if (!horarios || horarios.length === 0) {
      // Fallback ao horário legado se não configurado
      const ha = (dist as any).horario_abertura, hf = (dist as any).horario_fechamento;
      if (ha && hf) aberto = isBetween(ha, hf);
    }

    if (!aberto) {
      for (let i = 0; i < 7; i++) {
        const d = (dow + i) % 7;
        const h = (horarios ?? []).find((x: any) => x.dia_semana === d);
        if (h && !h.is_fechado_o_dia_todo && h.horario_abertura) {
          if (i === 0 && minutesNow < toMin(h.horario_abertura)) {
            proximoDia = d; proximoHorario = h.horario_abertura.slice(0, 5); break;
          } else if (i > 0) {
            proximoDia = d; proximoHorario = h.horario_abertura.slice(0, 5); break;
          }
        }
      }
    }

    void hhmm; // usado apenas para debug futuro


    return { distribuidora: { ...dist, aberto, proximoDia, proximoHorario }, produtos, isBusiness, horarios: horarios ?? [] };
  });


// -------- Buscar cliente por telefone (autofill) --------
export const findClientePublico = createServerFn({ method: "POST" })
  .inputValidator((d: { distribuidora_id: string; telefone: string }) =>
    z.object({
      distribuidora_id: z.string().uuid(),
      telefone: z.string().min(4).max(20),
    }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const digits = data.telefone.replace(/\D/g, "");
    if (digits.length < 10) return null;
    const { data: cli } = await supabaseAdmin
      .from("clientes")
      .select("id,nome,telefone,endereco,cep,complemento")
      .eq("distribuidora_id", data.distribuidora_id)
      .eq("telefone", digits)
      .maybeSingle();
    return cli ?? null;

  });

// -------- Checkout público --------
export const checkoutLojaPublica = createServerFn({ method: "POST" })
  .inputValidator((d: {
    distribuidora_id: string;
    cliente: { nome: string; telefone: string; endereco: string; cep?: string; complemento?: string };
    itens: Array<{ produto_id: string; quantidade: number }>;
    forma_pagamento: "pix" | "cartao" | "dinheiro";
    troco_para?: number | null;
    observacoes?: string;
    is_pre_order?: boolean;
    verification_token?: string;



  }) => z.object({
    distribuidora_id: z.string().uuid(),
    cliente: z.object({
      nome: z.string().trim().min(2).max(120),
      telefone: z.string().min(10).max(20),
      endereco: z.string().trim().min(3).max(500),
      cep: z.string().trim().max(20).optional(),
      complemento: z.string().trim().max(160).optional(),
    }),
    itens: z.array(z.object({
      produto_id: z.string().uuid(),
      quantidade: z.number().int().min(1).max(999),
    })).min(1).max(50),
    forma_pagamento: z.enum(["pix", "cartao", "dinheiro"]),
    troco_para: z.number().positive().max(10000).nullish(),
    observacoes: z.string().max(300).optional(),
    is_pre_order: z.boolean().optional(),
    verification_token: z.string().uuid().optional(),
  }).parse(d))

  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: dist, error: eDist } = await supabaseAdmin
      .from("distribuidoras")
      .select("id,nome,email,plano,taxa_entrega_padrao,telefone,verificacao_whatsapp")
      .eq("id", data.distribuidora_id)
      .maybeSingle();
    if (eDist) throw eDist;
    if (!dist) throw new Error("Loja não encontrada");

    // Verificação por WhatsApp (rollout por loja)
    if ((dist as any).verificacao_whatsapp === true) {
      const { assertTelefoneVerificado } = await import("@/lib/otp.functions");
      try {
        await assertTelefoneVerificado({
          distribuidora_id: dist.id,
          telefone: data.cliente.telefone,
          token: data.verification_token ?? null,
        });
      } catch {
        throw new Error("Verifique seu telefone antes de finalizar.");
      }
    }


    // Upsert cliente
    const digits = data.cliente.telefone.replace(/\D/g, "");
    const { data: existing } = await supabaseAdmin
      .from("clientes").select("id")
      .eq("distribuidora_id", dist.id).eq("telefone", digits).maybeSingle();
    let clienteId = existing?.id as string | undefined;
    const nomeNorm = normalizeProperName(data.cliente.nome);
    const complNorm = data.cliente.complemento ? normalizeSentence(data.cliente.complemento) : null;
    // O endereço salvo no cliente inclui o complemento para exibição imediata
    // nos painéis do lojista (lista de clientes, detalhes de pedido, histórico).
    const enderecoBase = normalizeSentence(data.cliente.endereco);
    const endNorm = complNorm ? `${enderecoBase} — Compl: ${complNorm}` : enderecoBase;
    if (clienteId) {
      await supabaseAdmin.from("clientes").update({
        nome: nomeNorm,
        endereco: endNorm,
        cep: data.cliente.cep ?? null,
        complemento: complNorm,
      }).eq("id", clienteId);
    } else {
      const { data: novo, error: eCli } = await supabaseAdmin.from("clientes").insert({
        distribuidora_id: dist.id,
        nome: nomeNorm,
        telefone: digits,
        endereco: endNorm,
        cep: data.cliente.cep ?? null,
        complemento: complNorm,
      }).select("id").single();
      if (eCli) throw eCli;
      clienteId = novo.id;
    }



    // Produtos + validação categoria por plano
    const ids = data.itens.map(i => i.produto_id);
    const { data: prods, error: ePr } = await supabaseAdmin
      .from("produtos")
      .select("id,preco,estoque,nome,categoria")
      .in("id", ids)
      .eq("distribuidora_id", dist.id)
      .eq("ativo", true);
    if (ePr) throw ePr;
    const isBusiness = (dist as any).plano === "business";
    const map = new Map((prods ?? []).map((p: any) => [p.id, p]));
    let subtotal = 0;
    const itensPayload = data.itens.map(i => {
      const p: any = map.get(i.produto_id);
      if (!p) throw new Error("Produto inválido");
      if (!isBusiness && p.categoria !== "agua") throw new Error("Produto indisponível para este plano");
      const sub = Number(p.preco) * i.quantidade;
      subtotal += sub;
      return { produto_id: i.produto_id, quantidade: i.quantidade, preco_unit: Number(p.preco), subtotal: sub };
    });

    const taxa = Number((dist as any).taxa_entrega_padrao ?? 0);
    const total = subtotal + taxa;

    const isPreOrder = !!data.is_pre_order;
    const isPix = data.forma_pagamento === "pix";
    // Pré-pedidos ficam sempre pendentes até o lojista abrir
    const status = isPreOrder ? "pendente" : (isPix ? "pendente" : "preparo");

    let codigo_pix: string | null = null;
    let mp_payment_id: string | null = null;
    let pix_qr_base64: string | null = null;

    if (isPix) {
      try {
        const { getValidMpToken, criarPixMercadoPago } = await import("@/lib/mp.server");
        const token = await getValidMpToken(dist.id);
        if (token) {
          const emailPagador = `cliente-${digits}@pedirapido.com.br`;
          const pix = await criarPixMercadoPago({
            token,
            valor: total,
            descricao: `Pedido - ${dist.nome}`,
            payerEmail: emailPagador,
            payerNome: nomeNorm ?? "Cliente",
          });
          if (pix) {
            codigo_pix = pix.copia_e_cola;
            mp_payment_id = pix.payment_id;
            pix_qr_base64 = pix.qr_base64;
          }
        }
      } catch (err) {
        console.error("[checkout] Mercado Pago indisponível, usando fallback estático");
        void err;
      }
      if (!codigo_pix) {
        codigo_pix = generatePixCode({ chave: (dist as any).email, nome: dist.nome, cidade: "SAO PAULO", valor: total });
      }
    }

    const obsParts = [isPreOrder ? `[Pré-pedido]` : `[Cardápio Web]`];
    if (data.observacoes) obsParts.push(data.observacoes);
    if (data.forma_pagamento === "dinheiro" && data.troco_para)
      obsParts.push(`Troco para R$ ${data.troco_para.toFixed(2)}`);

    const { data: pedido, error: ePed } = await supabaseAdmin.from("pedidos").insert({
      distribuidora_id: dist.id,
      cliente_id: clienteId!,
      subtotal, taxa_entrega: taxa, total,
      status: status as any,
      codigo_pix,
      mp_payment_id,
      pix_qr_base64,
      observacoes: obsParts.join(" | "),
      pago_at: (isPix || isPreOrder) ? null : new Date().toISOString(),
      forma_pagamento: data.forma_pagamento,
      is_pre_order: isPreOrder,
    } as any).select("id,total,status,codigo_pix,pix_qr_base64").single();
    if (ePed) throw ePed;




    const { error: eIt } = await supabaseAdmin.from("pedido_itens")
      .insert(itensPayload.map(it => ({ ...it, pedido_id: pedido.id })));
    if (eIt) throw eIt;

    // Estoque
    for (const it of data.itens) {
      const p: any = map.get(it.produto_id);
      const novoEstoque = Math.max(0, Number(p.estoque) - it.quantidade);
      await supabaseAdmin.from("produtos").update({ estoque: novoEstoque }).eq("id", it.produto_id);
    }

    // Notifica o WhatsApp do lojista quando é pré-pedido (loja fechada)
    if (isPreOrder) {
      try {
        const telLojista = (dist as any).telefone as string | null;
        if (telLojista) {
          const { sendWhatsApp } = await import("@/lib/whatsapp.server");
          const nomeCli = data.cliente.nome?.trim() || "Cliente";
          const msg =
            `🚨 NOVO PRÉ-PEDIDO RECEBIDO!\n\n` +
            `O cliente ${nomeCli} acabou de realizar um pedido de R$ ${total.toFixed(2)} ` +
            `enquanto a loja está fechada. O pedido já foi reservado na sua fila de prioridade para a próxima abertura! 🚀`;
          const r = await sendWhatsApp(telLojista, msg);
          await supabaseAdmin.from("notificacoes_whatsapp").insert({
            distribuidora_id: dist.id,
            pedido_id: pedido.id,
            tipo: "pre_pedido_lojista",
            telefone: telLojista,
            mensagem: msg,
            status: r.status,
            provider_response: r.response as any,
          });
        }
      } catch (err) {
        console.error("[pre-order] falha ao notificar lojista", err);
      }
    }

    return { id: pedido.id, status, total, codigo_pix, pix_qr_base64 };
  });


// -------- Acompanhamento público de pedido --------
export const getPedidoPublico = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pedido, error } = await supabaseAdmin
      .from("pedidos")
      .select("id,status,total,subtotal,taxa_entrega,forma_pagamento,codigo_pix,pix_qr_base64,created_at,pago_at,entregue_at,distribuidora_id,distribuidora:distribuidoras(nome,nome_fantasia,razao_social,cnpj,tempo_estimado_min,telefone,logo_url),itens:pedido_itens(quantidade,preco_unit,subtotal,produto:produtos(nome,volume_valor,volume_unidade,marca,tipo_embalagem)),entregador:entregadores(nome,veiculo_modelo,veiculo_placa)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!pedido) throw new Error("Pedido não encontrado");
    return pedido;
  });

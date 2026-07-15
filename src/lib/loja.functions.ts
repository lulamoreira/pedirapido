import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generatePixCode } from "@/lib/pix";

// -------- Carregar loja pública (distribuidora + catálogo) --------
export const getLojaPublica = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: dist, error } = await supabaseAdmin
      .from("distribuidoras")
      .select("id,nome,telefone,plano,taxa_entrega_padrao,horario_abertura,horario_fechamento,tempo_estimado_min,status_assinatura")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!dist) throw new Error("Loja não encontrada");

    const { data: prods } = await supabaseAdmin
      .from("produtos")
      .select("id,nome,descricao,preco,categoria,estoque")
      .eq("distribuidora_id", dist.id)
      .eq("ativo", true)
      .order("categoria")
      .order("nome");

    // FREE/PRO: só categoria "agua". BUSINESS: tudo.
    const isBusiness = (dist as any).plano === "business";
    const produtos = (prods ?? []).filter((p: any) => isBusiness || p.categoria === "agua");

    // Aberto/fechado (comparação HH:mm)
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const aberto =
      hhmm >= (dist as any).horario_abertura &&
      hhmm <= (dist as any).horario_fechamento;

    return { distribuidora: { ...dist, aberto }, produtos, isBusiness };
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
      .select("id,nome,telefone,endereco,cep")
      .eq("distribuidora_id", data.distribuidora_id)
      .eq("telefone", digits)
      .maybeSingle();
    return cli ?? null;
  });

// -------- Checkout público --------
export const checkoutLojaPublica = createServerFn({ method: "POST" })
  .inputValidator((d: {
    distribuidora_id: string;
    cliente: { nome: string; telefone: string; endereco: string; cep?: string };
    itens: Array<{ produto_id: string; quantidade: number }>;
    forma_pagamento: "pix" | "cartao" | "dinheiro";
    troco_para?: number | null;
    observacoes?: string;
  }) => z.object({
    distribuidora_id: z.string().uuid(),
    cliente: z.object({
      nome: z.string().trim().min(2).max(120),
      telefone: z.string().min(10).max(20),
      endereco: z.string().trim().min(3).max(500),
      cep: z.string().trim().max(20).optional(),
    }),
    itens: z.array(z.object({
      produto_id: z.string().uuid(),
      quantidade: z.number().int().min(1).max(999),
    })).min(1).max(50),
    forma_pagamento: z.enum(["pix", "cartao", "dinheiro"]),
    troco_para: z.number().positive().max(10000).nullish(),
    observacoes: z.string().max(300).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: dist, error: eDist } = await supabaseAdmin
      .from("distribuidoras")
      .select("id,nome,email,plano,taxa_entrega_padrao")
      .eq("id", data.distribuidora_id)
      .maybeSingle();
    if (eDist) throw eDist;
    if (!dist) throw new Error("Loja não encontrada");

    // Upsert cliente
    const digits = data.cliente.telefone.replace(/\D/g, "");
    const { data: existing } = await supabaseAdmin
      .from("clientes").select("id")
      .eq("distribuidora_id", dist.id).eq("telefone", digits).maybeSingle();
    let clienteId = existing?.id as string | undefined;
    if (clienteId) {
      await supabaseAdmin.from("clientes").update({
        nome: data.cliente.nome,
        endereco: data.cliente.endereco,
        cep: data.cliente.cep ?? null,
      }).eq("id", clienteId);
    } else {
      const { data: novo, error: eCli } = await supabaseAdmin.from("clientes").insert({
        distribuidora_id: dist.id,
        nome: data.cliente.nome,
        telefone: digits,
        endereco: data.cliente.endereco,
        cep: data.cliente.cep ?? null,
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

    const isPix = data.forma_pagamento === "pix";
    const status = isPix ? "pendente" : "preparo";
    const codigo_pix = isPix
      ? generatePixCode({ chave: (dist as any).email, nome: dist.nome, cidade: "SAO PAULO", valor: total })
      : null;

    const obsParts = [`[Cardápio Web]`];
    if (data.observacoes) obsParts.push(data.observacoes);
    if (data.forma_pagamento === "dinheiro" && data.troco_para)
      obsParts.push(`Troco para R$ ${data.troco_para.toFixed(2)}`);

    const { data: pedido, error: ePed } = await supabaseAdmin.from("pedidos").insert({
      distribuidora_id: dist.id,
      cliente_id: clienteId!,
      subtotal, taxa_entrega: taxa, total,
      status: status as any,
      codigo_pix,
      observacoes: obsParts.join(" | "),
      pago_at: isPix ? null : new Date().toISOString(),
      forma_pagamento: data.forma_pagamento,
    } as any).select("id,total,status,codigo_pix").single();
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

    return { id: pedido.id, status, total, codigo_pix };
  });

// -------- Acompanhamento público de pedido --------
export const getPedidoPublico = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pedido, error } = await supabaseAdmin
      .from("pedidos")
      .select("id,status,total,subtotal,taxa_entrega,forma_pagamento,codigo_pix,created_at,pago_at,entregue_at,distribuidora_id,distribuidora:distribuidoras(nome,tempo_estimado_min),itens:pedido_itens(quantidade,preco_unit,subtotal,produto:produtos(nome)),entregador:entregadores(nome,veiculo_modelo,veiculo_placa)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!pedido) throw new Error("Pedido não encontrado");
    return pedido;
  });

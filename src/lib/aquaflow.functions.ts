import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generatePixCode } from "@/lib/pix";

const MASTER_EMAILS = ["lula1973@gmail.com", "lula1973@gmail.com.br"];

async function getDistId(supabase: any, userId: string) {
  const { data } = await supabase.from("distribuidoras").select("id").eq("owner_user_id", userId).maybeSingle();
  return data?.id as string | undefined;
}

// -------- Dashboard summary --------
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const { data: dist } = await supabase
      .from("distribuidoras")
      .select("*")
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (!dist) throw new Error("Distribuidora não encontrada");

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

    const [{ data: pedidosHoje }, { data: pedidosMes }, { data: ativos }, { data: produtos }] = await Promise.all([
      supabase.from("pedidos").select("total,status").eq("distribuidora_id", dist.id).gte("created_at", startOfDay.toISOString()),
      supabase.from("pedidos").select("id").eq("distribuidora_id", dist.id).gte("created_at", startOfMonth.toISOString()),
      supabase.from("pedidos").select("id,total,status,created_at,cliente:clientes(nome,telefone)").eq("distribuidora_id", dist.id).in("status", ["pendente", "preparo", "pago", "rota"]).order("created_at", { ascending: false }).limit(10),
      supabase.from("produtos").select("id,nome,estoque,estoque_minimo").eq("distribuidora_id", dist.id).eq("ativo", true),
    ]);

    const receitaHoje = (pedidosHoje ?? []).filter((p: any) => p.status !== "cancelado").reduce((s: number, p: any) => s + Number(p.total), 0);
    const isMasterEmail = claims?.email ? MASTER_EMAILS.includes(String(claims.email).toLowerCase()) : false;
    const { data: masterRole } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin_master").maybeSingle();

    return {
      distribuidora: dist,
      receitaHoje,
      totalHoje: (pedidosHoje ?? []).length,
      totalMes: (pedidosMes ?? []).length,
      pedidosAtivos: ativos ?? [],
      estoqueBaixo: (produtos ?? []).filter((p: any) => p.estoque <= p.estoque_minimo),
      limiteFree: 50,
      isAdminMaster: !!masterRole || isMasterEmail,
    };
  });

// -------- Pedidos list --------
export const listPedidos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const distId = await getDistId(context.supabase, context.userId);
    if (!distId) return [];
    let q = context.supabase.from("pedidos").select("id,total,status,created_at,cliente:clientes(nome,telefone,endereco)").eq("distribuidora_id", distId).order("created_at", { ascending: false }).limit(100);
    if (data.status && data.status !== "todos") q = q.eq("status", data.status as never);
    const { data: pedidos, error } = await q;
    if (error) throw error;
    return pedidos ?? [];
  });

// -------- Pedido detail --------
export const getPedido = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: pedido, error } = await context.supabase
      .from("pedidos")
      .select("*,cliente:clientes(*),itens:pedido_itens(*,produto:produtos(nome)),entregador:entregadores(id,nome,telefone,veiculo_modelo,veiculo_placa)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!pedido) throw new Error("Pedido não encontrado");
    return pedido;
  });

// -------- Update pedido status --------
export const updatePedidoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: string }) =>
    z.object({ id: z.string().uuid(), status: z.enum(["pendente", "preparo", "pago", "rota", "entregue", "cancelado"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const patch: any = { status: data.status };
    if (data.status === "pago") patch.pago_at = new Date().toISOString();
    if (data.status === "entregue") patch.entregue_at = new Date().toISOString();
    const { error } = await context.supabase.from("pedidos").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// -------- Assign entregador --------
export const assignEntregador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pedidoId: string; entregadorId: string | null }) =>
    z.object({ pedidoId: z.string().uuid(), entregadorId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("pedidos").update({ entregador_id: data.entregadorId }).eq("id", data.pedidoId);
    if (error) throw error;
    return { ok: true };
  });

// -------- Produtos --------
export const listProdutos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const distId = await getDistId(context.supabase, context.userId);
    if (!distId) return [];
    const { data } = await context.supabase.from("produtos").select("*").eq("distribuidora_id", distId).eq("ativo", true).order("nome");
    return data ?? [];
  });

export const upsertProduto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; nome: string; preco: number; estoque: number; estoque_minimo: number }) =>
    z.object({ id: z.string().uuid().optional(), nome: z.string().min(1).max(80), preco: z.number().min(0), estoque: z.number().int().min(0), estoque_minimo: z.number().int().min(0) }).parse(d))
  .handler(async ({ data, context }) => {
    const distId = await getDistId(context.supabase, context.userId);
    if (!distId) throw new Error("Distribuidora não encontrada");
    if (data.id) {
      const { error } = await context.supabase.from("produtos").update({ nome: data.nome, preco: data.preco, estoque: data.estoque, estoque_minimo: data.estoque_minimo }).eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await context.supabase.from("produtos").insert({ distribuidora_id: distId, nome: data.nome, preco: data.preco, estoque: data.estoque, estoque_minimo: data.estoque_minimo });
      if (error) throw error;
    }
    return { ok: true };
  });

export const deleteProduto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("produtos").update({ ativo: false }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// -------- Entregas / Rota --------
export const listEntregas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const distId = await getDistId(context.supabase, context.userId);
    if (!distId) return [];
    const { data } = await context.supabase
      .from("pedidos")
      .select("id,total,status,created_at,cliente:clientes(nome,telefone,endereco),entregador:entregadores(nome,veiculo_placa)")
      .eq("distribuidora_id", distId)
      .in("status", ["pago", "rota"])
      .order("created_at", { ascending: true });
    return data ?? [];
  });

// -------- Entregadores CRUD --------
export const listEntregadores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const distId = await getDistId(context.supabase, context.userId);
    if (!distId) return [];
    const { data, error } = await (context.supabase as any).from("entregadores").select("*").eq("distribuidora_id", distId).order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const upsertEntregador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; nome: string; telefone?: string; veiculo_modelo?: string; veiculo_placa?: string; status: "disponivel" | "em_entrega" | "inativo" }) =>
    z.object({
      id: z.string().uuid().optional(),
      nome: z.string().min(2).max(80),
      telefone: z.string().max(20).optional(),
      veiculo_modelo: z.string().max(60).optional(),
      veiculo_placa: z.string().max(10).optional(),
      status: z.enum(["disponivel", "em_entrega", "inativo"]),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const distId = await getDistId(context.supabase, context.userId);
    if (!distId) throw new Error("Distribuidora não encontrada");
    const payload: any = {
      nome: data.nome, telefone: data.telefone ?? null,
      veiculo_modelo: data.veiculo_modelo ?? null, veiculo_placa: data.veiculo_placa ?? null,
      status: data.status,
    };
    if (data.id) {
      const { error } = await (context.supabase as any).from("entregadores").update(payload).eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await (context.supabase as any).from("entregadores").insert({ ...payload, distribuidora_id: distId });
      if (error) throw error;
    }
    return { ok: true };
  });

export const deleteEntregador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("entregadores").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// -------- Configurações da distribuidora --------
export const updateDistribuidoraConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { nome: string; telefone?: string; horario_abertura: string; horario_fechamento: string; taxa_entrega_padrao: number; tempo_estimado_min: number }) =>
    z.object({
      nome: z.string().min(2).max(80),
      telefone: z.string().max(20).optional(),
      horario_abertura: z.string().regex(/^\d{2}:\d{2}$/),
      horario_fechamento: z.string().regex(/^\d{2}:\d{2}$/),
      taxa_entrega_padrao: z.number().min(0).max(999),
      tempo_estimado_min: z.number().int().min(5).max(600),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("distribuidoras").update({
      nome: data.nome, telefone: data.telefone ?? null,
      horario_abertura: data.horario_abertura, horario_fechamento: data.horario_fechamento,
      taxa_entrega_padrao: data.taxa_entrega_padrao, tempo_estimado_min: data.tempo_estimado_min,
    } as any).eq("owner_user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// -------- Buscar cliente por telefone (PDV) --------
export const searchClienteByPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { telefone: string }) => z.object({ telefone: z.string().min(4).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const distId = await getDistId(context.supabase, context.userId);
    if (!distId) return null;
    const digits = data.telefone.replace(/\D/g, "");
    const { data: cli } = await context.supabase.from("clientes").select("*").eq("distribuidora_id", distId).ilike("telefone", `%${digits}%`).limit(1).maybeSingle();
    return cli ?? null;
  });

// -------- Criar pedido manual (PDV) --------
export const createManualPedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    cliente: { nome: string; telefone: string; endereco?: string };
    itens: Array<{ produto_id: string; quantidade: number }>;
    forma_pagamento: "pix" | "cartao" | "dinheiro";
    observacoes?: string;
  }) => z.object({
    cliente: z.object({
      nome: z.string().min(1).max(80),
      telefone: z.string().min(4).max(20),
      endereco: z.string().max(200).optional(),
    }),
    itens: z.array(z.object({
      produto_id: z.string().uuid(),
      quantidade: z.number().int().min(1).max(999),
    })).min(1),
    forma_pagamento: z.enum(["pix", "cartao", "dinheiro"]),
    observacoes: z.string().max(300).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: dist } = await supabase.from("distribuidoras").select("*").eq("owner_user_id", userId).maybeSingle();
    if (!dist) throw new Error("Distribuidora não encontrada");

    // Limite do plano free
    if (dist.plano === "free") {
      const startMonth = new Date(); startMonth.setDate(1); startMonth.setHours(0, 0, 0, 0);
      const { count } = await supabase.from("pedidos").select("id", { count: "exact", head: true })
        .eq("distribuidora_id", dist.id).gte("created_at", startMonth.toISOString());
      if ((count ?? 0) >= 50) throw new Error("Limite do plano Free (50 pedidos/mês) atingido");
    }

    // Upsert cliente por telefone
    const telDigits = data.cliente.telefone.replace(/\D/g, "");
    const { data: existing } = await supabase.from("clientes").select("id")
      .eq("distribuidora_id", dist.id).eq("telefone", telDigits).maybeSingle();
    let clienteId = existing?.id as string | undefined;
    if (clienteId) {
      await supabase.from("clientes").update({
        nome: data.cliente.nome,
        endereco: data.cliente.endereco ?? null,
      }).eq("id", clienteId);
    } else {
      const { data: novo, error: errCli } = await supabase.from("clientes").insert({
        distribuidora_id: dist.id,
        nome: data.cliente.nome,
        telefone: telDigits,
        endereco: data.cliente.endereco ?? null,
      }).select("id").single();
      if (errCli) throw errCli;
      clienteId = novo.id;
    }

    // Produtos & subtotal
    const ids = data.itens.map(i => i.produto_id);
    const { data: prods, error: errProd } = await supabase.from("produtos").select("id,preco,estoque,nome").in("id", ids).eq("distribuidora_id", dist.id);
    if (errProd) throw errProd;
    const prodMap = new Map((prods ?? []).map((p: any) => [p.id, p]));
    let subtotal = 0;
    const itensPayload = data.itens.map(i => {
      const p: any = prodMap.get(i.produto_id);
      if (!p) throw new Error("Produto inválido");
      const sub = Number(p.preco) * i.quantidade;
      subtotal += sub;
      return { produto_id: i.produto_id, quantidade: i.quantidade, preco_unit: Number(p.preco), subtotal: sub };
    });

    const taxa = Number((dist as any).taxa_entrega_padrao ?? 0);
    const total = subtotal + taxa;

    // Status inicial: PIX = pendente (aguardando pgto), demais = pago (balcão) → segue para preparo? Regra: pendente confirmação manual em PIX; para cartão/dinheiro cria já como "pago" (aguardando entrega).
    const isPix = data.forma_pagamento === "pix";
    const status = isPix ? "pendente" : "pago";
    const codigo_pix = isPix
      ? generatePixCode({ chave: dist.email, nome: dist.nome, cidade: "SAO PAULO", valor: total })
      : null;

    const { data: pedido, error: errPed } = await supabase.from("pedidos").insert({
      distribuidora_id: dist.id,
      cliente_id: clienteId!,
      subtotal, taxa_entrega: taxa, total,
      status: status as any,
      codigo_pix,
      observacoes: data.observacoes ?? null,
      pago_at: isPix ? null : new Date().toISOString(),
      forma_pagamento: data.forma_pagamento,
    } as any).select("id").single();
    if (errPed) throw errPed;

    const { error: errItens } = await supabase.from("pedido_itens").insert(
      itensPayload.map(it => ({ ...it, pedido_id: pedido.id }))
    );
    if (errItens) throw errItens;

    // Decrementa estoque
    for (const it of data.itens) {
      const p: any = prodMap.get(it.produto_id);
      const novoEstoque = Math.max(0, Number(p.estoque) - it.quantidade);
      await supabase.from("produtos").update({ estoque: novoEstoque }).eq("id", it.produto_id);
    }

    return { id: pedido.id, status };
  });

// -------- Plano --------
export const getPlano = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const { data: dist } = await supabase.from("distribuidoras").select("*").eq("owner_user_id", userId).maybeSingle();
    if (!dist) throw new Error("Distribuidora não encontrada");
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const { data: mes } = await supabase.from("pedidos").select("id").eq("distribuidora_id", dist.id).gte("created_at", startOfMonth.toISOString());
    const { data: masterRole } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin_master").maybeSingle();
    const isMasterEmail = claims?.email ? MASTER_EMAILS.includes(String(claims.email).toLowerCase()) : false;
    return { distribuidora: dist, pedidosMes: mes?.length ?? 0, limiteFree: 50, isAdminMaster: !!masterRole || isMasterEmail };
  });

export const signOutServer = createServerFn({ method: "POST" }).handler(async () => ({ ok: true }));

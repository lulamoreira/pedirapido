import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// -------- Dashboard summary --------
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: dist } = await supabase
      .from("distribuidoras")
      .select("*")
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (!dist) throw new Error("Distribuidora não encontrada");

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [{ data: pedidosHoje }, { data: pedidosMes }, { data: ativos }, { data: produtos }] =
      await Promise.all([
        supabase.from("pedidos").select("total,status").eq("distribuidora_id", dist.id).gte("created_at", startOfDay.toISOString()),
        supabase.from("pedidos").select("id").eq("distribuidora_id", dist.id).gte("created_at", startOfMonth.toISOString()),
        supabase.from("pedidos").select("id,total,status,created_at,cliente:clientes(nome,telefone)").eq("distribuidora_id", dist.id).in("status", ["pendente", "preparo", "pago", "rota"]).order("created_at", { ascending: false }).limit(10),
        supabase.from("produtos").select("id,nome,estoque,estoque_minimo").eq("distribuidora_id", dist.id).eq("ativo", true),
      ]);

    const receitaHoje = (pedidosHoje ?? []).filter(p => p.status !== "cancelado").reduce((s, p) => s + Number(p.total), 0);
    const totalHoje = (pedidosHoje ?? []).length;
    const totalMes = (pedidosMes ?? []).length;
    const estoqueBaixo = (produtos ?? []).filter(p => p.estoque <= p.estoque_minimo);

    return {
      distribuidora: dist,
      receitaHoje,
      totalHoje,
      totalMes,
      pedidosAtivos: ativos ?? [],
      estoqueBaixo,
      limiteFree: 50,
    };
  });

// -------- Pedidos list --------
export const listPedidos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: dist } = await supabase.from("distribuidoras").select("id").eq("owner_user_id", userId).maybeSingle();
    if (!dist) return [];
    let q = supabase.from("pedidos").select("id,total,status,created_at,cliente:clientes(nome,telefone,endereco)").eq("distribuidora_id", dist.id).order("created_at", { ascending: false }).limit(100);
    if (data.status && data.status !== "todos") {
      q = q.eq("status", data.status as never);
    }
    const { data: pedidos, error } = await q;
    if (error) throw error;
    return pedidos ?? [];
  });

// -------- Pedido detail --------
export const getPedido = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: pedido, error } = await supabase
      .from("pedidos")
      .select("*,cliente:clientes(*),itens:pedido_itens(*,produto:produtos(nome))")
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
    z.object({
      id: z.string().uuid(),
      status: z.enum(["pendente", "preparo", "pago", "rota", "entregue", "cancelado"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      status: typeof data.status;
      pago_at?: string;
      entregue_at?: string;
    } = { status: data.status };
    if (data.status === "pago") patch.pago_at = new Date().toISOString();
    if (data.status === "entregue") patch.entregue_at = new Date().toISOString();
    const { error } = await context.supabase.from("pedidos").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// -------- Produtos --------
export const listProdutos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: dist } = await supabase.from("distribuidoras").select("id").eq("owner_user_id", userId).maybeSingle();
    if (!dist) return [];
    const { data } = await supabase.from("produtos").select("*").eq("distribuidora_id", dist.id).order("nome");
    return data ?? [];
  });

export const upsertProduto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; nome: string; preco: number; estoque: number; estoque_minimo: number }) =>
    z.object({
      id: z.string().uuid().optional(),
      nome: z.string().min(1).max(80),
      preco: z.number().min(0),
      estoque: z.number().int().min(0),
      estoque_minimo: z.number().int().min(0),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: dist } = await supabase.from("distribuidoras").select("id").eq("owner_user_id", userId).maybeSingle();
    if (!dist) throw new Error("Distribuidora não encontrada");
    if (data.id) {
      const { error } = await supabase.from("produtos").update({
        nome: data.nome, preco: data.preco, estoque: data.estoque, estoque_minimo: data.estoque_minimo,
      }).eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("produtos").insert({
        distribuidora_id: dist.id,
        nome: data.nome, preco: data.preco, estoque: data.estoque, estoque_minimo: data.estoque_minimo,
      });
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

// -------- Entregador --------
export const listEntregas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: dist } = await supabase.from("distribuidoras").select("id").eq("owner_user_id", userId).maybeSingle();
    if (!dist) return [];
    const { data } = await supabase
      .from("pedidos")
      .select("id,total,status,created_at,cliente:clientes(nome,telefone,endereco)")
      .eq("distribuidora_id", dist.id)
      .in("status", ["pago", "rota"])
      .order("created_at", { ascending: true });
    return data ?? [];
  });

// -------- Plano --------
export const getPlano = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: dist } = await supabase.from("distribuidoras").select("*").eq("owner_user_id", userId).maybeSingle();
    if (!dist) throw new Error("Distribuidora não encontrada");
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const { data: mes } = await supabase.from("pedidos").select("id").eq("distribuidora_id", dist.id).gte("created_at", startOfMonth.toISOString());
    return { distribuidora: dist, pedidosMes: mes?.length ?? 0, limiteFree: 50 };
  });

export const signOutServer = createServerFn({ method: "POST" }).handler(async () => ({ ok: true }));

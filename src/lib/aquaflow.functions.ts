import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generatePixCode } from "@/lib/pix";
import { normalizeProperName, normalizeSentence } from "@/lib/text-normalize";


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

    const [{ data: pedidosHoje }, { data: pedidosMes }, { data: ativos }, { data: produtos }, { data: preOrders }] = await Promise.all([
      supabase.from("pedidos").select("total,status").eq("distribuidora_id", dist.id).gte("created_at", startOfDay.toISOString()),
      supabase.from("pedidos").select("id").eq("distribuidora_id", dist.id).gte("created_at", startOfMonth.toISOString()),
      supabase.from("pedidos").select("id,total,status,created_at,cliente:clientes(id,nome,telefone)").eq("distribuidora_id", dist.id).in("status", ["pendente", "preparo", "pago", "rota"]).order("created_at", { ascending: false }).limit(10),
      supabase.from("produtos").select("id,nome,estoque,estoque_minimo").eq("distribuidora_id", dist.id).eq("ativo", true),
      supabase.from("pedidos").select("id").eq("distribuidora_id", dist.id).eq("is_pre_order", true).eq("status", "pendente"),
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
      preOrdersCount: (preOrders ?? []).length,
      limiteFree: 50,
      isAdminMaster: !!masterRole || isMasterEmail,
    };
  });


// -------- Pedidos list --------
export const listPedidos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; preOrder?: boolean } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const distId = await getDistId(context.supabase, context.userId);
    if (!distId) return [];
    let q = context.supabase.from("pedidos").select("id,total,status,created_at,is_pre_order,cliente:clientes(id,nome,telefone,endereco)").eq("distribuidora_id", distId).order("created_at", { ascending: false }).limit(100);
    if (data.status && data.status !== "todos") q = q.eq("status", data.status as never);
    if (data.preOrder) q = q.eq("is_pre_order", true);
    const { data: pedidos, error } = await q;
    if (error) throw error;
    return pedidos ?? [];
  });

// -------- Resumo de pré-pedidos pendentes (para modal de abertura) --------
export const listPreOrdersResumo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const distId = await getDistId(context.supabase, context.userId);
    if (!distId) return [];
    const { data, error } = await context.supabase
      .from("pedidos")
      .select("id,total,created_at,cliente:clientes(nome),itens:pedido_itens(quantidade,produto:produtos(nome,volume_valor,volume_unidade))")
      .eq("distribuidora_id", distId)
      .eq("is_pre_order", true)
      .eq("status", "pendente")
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw error;
    return data ?? [];
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

    // Libera o entregador quando pedido é entregue ou cancelado
    if (data.status === "entregue" || data.status === "cancelado") {
      const { data: ped } = await context.supabase.from("pedidos").select("entregador_id").eq("id", data.id).maybeSingle();
      if (ped?.entregador_id) {
        await (context.supabase as any).from("entregadores").update({ status: "disponivel" }).eq("id", ped.entregador_id);
      }
    }

    // WhatsApp: pós-venda quando entregue
    if (data.status === "entregue") {
      const { data: full } = await context.supabase
        .from("pedidos")
        .select("id,distribuidora_id,cliente:clientes(nome,telefone),entregador:entregadores(nome,veiculo_modelo,veiculo_placa)")
        .eq("id", data.id).maybeSingle();
      const f: any = full;
      if (f?.cliente?.telefone) {
        const { notifyAndLog } = await import("@/lib/whatsapp.server");
        await notifyAndLog(context.supabase, {
          tipo: "entregue",
          pedidoId: f.id,
          distribuidoraId: f.distribuidora_id,
          telefone: f.cliente.telefone,
          clienteNome: f.cliente.nome,
          entregadorNome: f.entregador?.nome,
          veiculo: f.entregador?.veiculo_modelo,
          placa: f.entregador?.veiculo_placa,
        });
      }
    }
    return { ok: true };
  });

// -------- Notificações WhatsApp (log) --------
export const listNotificacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pedidoId: string }) => z.object({ pedidoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await (context.supabase as any)
      .from("notificacoes_whatsapp")
      .select("id,tipo,status,telefone,created_at")
      .eq("pedido_id", data.pedidoId)
      .order("created_at", { ascending: false });
    return rows ?? [];
  });

// -------- Assign entregador --------
export const assignEntregador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pedidoId: string; entregadorId: string | null }) =>
    z.object({ pedidoId: z.string().uuid(), entregadorId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    // Libera entregador anterior (se houver e for diferente do novo)
    const { data: atual } = await context.supabase.from("pedidos").select("entregador_id").eq("id", data.pedidoId).maybeSingle();
    if (atual?.entregador_id && atual.entregador_id !== data.entregadorId) {
      await (context.supabase as any).from("entregadores").update({ status: "disponivel" }).eq("id", atual.entregador_id);
    }

    const patch: any = { entregador_id: data.entregadorId };
    if (data.entregadorId) patch.status = "rota";
    const { error } = await context.supabase.from("pedidos").update(patch).eq("id", data.pedidoId);
    if (error) throw error;

    if (data.entregadorId) {
      await (context.supabase as any).from("entregadores").update({ status: "em_entrega" }).eq("id", data.entregadorId);

      // WhatsApp: "saiu para entrega"
      const { data: full } = await context.supabase
        .from("pedidos")
        .select("id,distribuidora_id,cliente:clientes(nome,telefone),entregador:entregadores(nome,veiculo_modelo,veiculo_placa)")
        .eq("id", data.pedidoId).maybeSingle();
      const f: any = full;
      if (f?.cliente?.telefone) {
        const { notifyAndLog } = await import("@/lib/whatsapp.server");
        await notifyAndLog(context.supabase, {
          tipo: "rota",
          pedidoId: f.id,
          distribuidoraId: f.distribuidora_id,
          telefone: f.cliente.telefone,
          clienteNome: f.cliente.nome,
          entregadorNome: f.entregador?.nome,
          veiculo: f.entregador?.veiculo_modelo,
          placa: f.entregador?.veiculo_placa,
        });
      }
    }
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
  .inputValidator((d: { id?: string; nome: string; preco: number; estoque: number; estoque_minimo: number; categoria: "agua" | "bebidas" | "descartaveis" | "petiscos" | "outros"; volume_valor?: number | null; volume_unidade?: "L" | "ml" | null; marca?: string | null; tipo_embalagem?: string | null; descricao?: string | null }) =>
    z.object({
      id: z.string().uuid().optional(),
      nome: z.string().min(1).max(80),
      preco: z.number().min(0),
      estoque: z.number().int().min(0),
      estoque_minimo: z.number().int().min(0),
      categoria: z.enum(["agua", "bebidas", "descartaveis", "petiscos", "outros"]),
      volume_valor: z.number().positive().max(100000).nullish(),
      volume_unidade: z.enum(["L", "ml"]).nullish(),
      marca: z.string().max(80).nullish(),
      tipo_embalagem: z.string().max(60).nullish(),
      descricao: z.string().max(300).nullish(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const distId = await getDistId(context.supabase, context.userId);
    if (!distId) throw new Error("Distribuidora não encontrada");
    // Validação de plano: apenas Business libera categorias fora de "agua"
    const { data: dist } = await context.supabase.from("distribuidoras").select("plano").eq("id", distId).maybeSingle();
    if (data.categoria !== "agua" && (dist?.plano ?? "free") !== "business") {
      throw new Error("Categoria disponível apenas no plano Business. Faça upgrade em /plano.");
    }
    const payload: any = {
      nome: normalizeSentence(data.nome),
      preco: data.preco, estoque: data.estoque, estoque_minimo: data.estoque_minimo, categoria: data.categoria,
      volume_valor: data.volume_valor ?? null,
      volume_unidade: data.volume_valor ? (data.volume_unidade ?? "L") : null,
      marca: data.marca ? normalizeSentence(data.marca) : null,
      tipo_embalagem: data.tipo_embalagem ? normalizeSentence(data.tipo_embalagem) : null,
      descricao: data.descricao ? normalizeSentence(data.descricao) : null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("produtos").update(payload).eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await context.supabase.from("produtos").insert({ ...payload, distribuidora_id: distId });
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

    // Se o usuário logado é um entregador vinculado, filtra pelos pedidos dele
    const { data: meuEntregador } = await (context.supabase as any)
      .from("entregadores").select("id").eq("user_id", context.userId).maybeSingle();

    let q = context.supabase
      .from("pedidos")
      .select("id,total,status,created_at,entregador_id,cliente:clientes(nome,telefone,endereco),entregador:entregadores(nome,veiculo_placa)")
      .eq("distribuidora_id", distId)
      .in("status", ["pago", "rota"])
      .order("created_at", { ascending: true });

    if (meuEntregador?.id) q = q.eq("entregador_id", meuEntregador.id);
    const { data } = await q;
    return data ?? [];
  });

// Retorna o cadastro de entregador vinculado ao usuário logado (ou null)
export const getMeuEntregador = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("entregadores").select("*").eq("user_id", context.userId).maybeSingle();
    return data ?? null;
  });

// Vincula a conta do usuário logado a um cadastro de entregador (match por telefone dentro da distribuidora)
export const claimEntregador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { telefone: string }) => z.object({ telefone: z.string().min(4).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const digits = data.telefone.replace(/\D/g, "");
    // Procura entregador com telefone que contenha os dígitos e sem user_id vinculado
    const { data: cand, error } = await (context.supabase as any)
      .from("entregadores").select("id,user_id,telefone,distribuidora_id").is("user_id", null);
    if (error) throw error;
    const match = (cand ?? []).find((e: any) => (e.telefone ?? "").replace(/\D/g, "").endsWith(digits));
    if (!match) throw new Error("Nenhum cadastro de entregador encontrado com esse telefone. Peça para a distribuidora te cadastrar.");
    // Vincula: user_id gerenciável via política do dono da distribuidora OU do próprio entregador; usamos service role via política do owner? Não temos. Update direto — só funciona se RLS permitir. A política do entregador exige user_id = auth.uid(), o que não bate ainda. Usamos o admin client.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.from("entregadores").update({ user_id: context.userId }).eq("id", match.id);
    if (upErr) throw upErr;
    // Garante role 'entregador'
    // Garante role 'entregador' (unique em user_id,role,distribuidora_id)
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: context.userId, role: "entregador", distribuidora_id: match.distribuidora_id },
      { onConflict: "user_id,role,distribuidora_id" }
    );
    return { ok: true };
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
      nome: normalizeProperName(data.nome),
      telefone: data.telefone ?? null,
      veiculo_modelo: data.veiculo_modelo ? normalizeSentence(data.veiculo_modelo) : null,
      veiculo_placa: data.veiculo_placa ? String(data.veiculo_placa).toUpperCase() : null,
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
  .inputValidator((d: {
    nome_fantasia: string; razao_social?: string | null; telefone?: string;
    horario_abertura: string; horario_fechamento: string;
    taxa_entrega_padrao: number; tempo_estimado_min: number;
    cnpj?: string | null;
    cep?: string | null; logradouro?: string | null; numero?: string | null;
    complemento?: string | null; bairro?: string | null; cidade?: string | null; uf?: string | null;
    logo_url?: string | null;
    slug?: string | null;
    verificacao_whatsapp?: boolean;
  }) =>
    z.object({
      nome_fantasia: z.string().min(2).max(120),
      razao_social: z.string().max(200).nullish(),
      telefone: z.string().max(20).optional(),
      horario_abertura: z.string().regex(/^\d{2}:\d{2}$/),
      horario_fechamento: z.string().regex(/^\d{2}:\d{2}$/),
      taxa_entrega_padrao: z.number().min(0).max(999),
      tempo_estimado_min: z.number().int().min(5).max(600),
      cnpj: z.string().max(20).nullish(),
      cep: z.string().max(12).nullish(),
      logradouro: z.string().max(200).nullish(),
      numero: z.string().max(20).nullish(),
      complemento: z.string().max(120).nullish(),
      bairro: z.string().max(120).nullish(),
      cidade: z.string().max(120).nullish(),
      uf: z.string().max(2).nullish(),
      logo_url: z.string().max(500000).nullish(),
      slug: z.string().max(60).nullish(),
      verificacao_whatsapp: z.boolean().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const payload: Record<string, unknown> = {
      nome_fantasia: data.nome_fantasia,
      nome: data.nome_fantasia,
      razao_social: data.razao_social ?? null,
      telefone: data.telefone ?? null,
      horario_abertura: data.horario_abertura, horario_fechamento: data.horario_fechamento,
      taxa_entrega_padrao: data.taxa_entrega_padrao, tempo_estimado_min: data.tempo_estimado_min,
      cnpj: data.cnpj ?? null,
      cep: data.cep ?? null,
      logradouro: data.logradouro ? normalizeSentence(data.logradouro) : null,
      numero: data.numero ?? null,
      complemento: data.complemento ? normalizeSentence(data.complemento) : null,
      bairro: data.bairro ? normalizeSentence(data.bairro) : null,
      cidade: data.cidade ?? null, uf: data.uf ?? null,
    };

    if (data.logo_url !== undefined) payload.logo_url = data.logo_url;
    if (data.verificacao_whatsapp !== undefined) payload.verificacao_whatsapp = data.verificacao_whatsapp;


    // Slug: validar unicidade se enviado
    if (data.slug !== undefined && data.slug !== null && data.slug !== "") {
      const normalized = data.slug
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, " e ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
      if (!normalized) throw new Error("Link inválido");

      // Buscar distribuidora atual do usuário
      const { data: mine } = await context.supabase
        .from("distribuidoras").select("id").eq("owner_user_id", context.userId).maybeSingle();
      const myId = (mine as any)?.id;

      const { data: taken } = await context.supabase
        .from("distribuidoras").select("id").eq("slug", normalized).maybeSingle();
      if (taken && (taken as any).id !== myId) {
        throw new Error("Este link já está sendo usado por outra distribuidora.");
      }
      payload.slug = normalized;
    }

    const { error } = await context.supabase.from("distribuidoras").update(payload as never).eq("owner_user_id", context.userId);
    if (error) {
      if ((error as any).code === "23505") throw new Error("Este link já está sendo usado por outra distribuidora.");
      throw error;
    }
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

// -------- Listar clientes (CRM) --------
export const listClientes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string } | undefined) => ({ search: (d?.search ?? "").trim() }))
  .handler(async ({ data, context }) => {
    const distId = await getDistId(context.supabase, context.userId);
    if (!distId) return [];
    let q = context.supabase
      .from("clientes")
      .select("id,nome,telefone,endereco,created_at,pedidos:pedidos(id)")
      .eq("distribuidora_id", distId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.search) {
      const digits = data.search.replace(/\D/g, "");
      if (digits.length >= 3) q = q.or(`nome.ilike.%${data.search}%,telefone.ilike.%${digits}%`);
      else q = q.ilike("nome", `%${data.search}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []).map((c: any) => ({
      id: c.id, nome: c.nome, telefone: c.telefone, endereco: c.endereco,
      created_at: c.created_at, total_pedidos: (c.pedidos ?? []).length,
    }));
  });

// -------- Criar cliente manualmente (CRM) --------
export const createCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { nome: string; telefone: string; endereco: string; cep?: string }) =>
    z.object({
      nome: z.string().trim().min(2, "Nome muito curto").max(120),
      telefone: z.string().trim().min(8).max(20),
      endereco: z.string().trim().min(3, "Endereço obrigatório").max(500),
      cep: z.string().trim().max(20).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const distId = await getDistId(context.supabase, context.userId);
    if (!distId) throw new Error("Distribuidora não encontrada");
    const digits = data.telefone.replace(/\D/g, "");
    if (digits.length < 10) throw new Error("Telefone inválido");

    const { data: existing } = await context.supabase
      .from("clientes")
      .select("id,nome")
      .eq("distribuidora_id", distId)
      .eq("telefone", digits)
      .maybeSingle();
    if (existing) {
      throw new Error(`DUPLICATE:${existing.nome}`);
    }

    const { data: novo, error } = await context.supabase.from("clientes").insert({
      distribuidora_id: distId,
      nome: normalizeProperName(data.nome),
      telefone: digits,
      endereco: normalizeSentence(data.endereco),
      cep: data.cep?.trim() || null,
    }).select("*").single();
    if (error) throw error;
    return novo;
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
    const clienteNomeNorm = normalizeProperName(data.cliente.nome);
    const clienteEndNorm = data.cliente.endereco ? normalizeSentence(data.cliente.endereco) : null;
    if (clienteId) {
      await supabase.from("clientes").update({
        nome: clienteNomeNorm,
        endereco: clienteEndNorm,
      }).eq("id", clienteId);
    } else {
      const { data: novo, error: errCli } = await supabase.from("clientes").insert({
        distribuidora_id: dist.id,
        nome: clienteNomeNorm,
        telefone: telDigits,
        endereco: clienteEndNorm,
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

// -------- Cliente: histórico completo --------
export const getClienteHistorico = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clienteId: string }) => z.object({ clienteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const distId = await getDistId(context.supabase, context.userId);
    if (!distId) throw new Error("Distribuidora não encontrada");
    const { data: cliente, error: eCli } = await context.supabase
      .from("clientes").select("id,nome,telefone,endereco,cep,created_at")
      .eq("id", data.clienteId).eq("distribuidora_id", distId).maybeSingle();
    if (eCli) throw eCli;
    if (!cliente) throw new Error("Cliente não encontrado");
    const { data: pedidos } = await context.supabase
      .from("pedidos")
      .select("id,status,total,created_at,forma_pagamento,is_pre_order,entregador:entregadores(nome,veiculo_placa),itens:pedido_itens(quantidade,produto:produtos(nome,marca,tipo_embalagem,volume_valor,volume_unidade))")
      .eq("cliente_id", data.clienteId)
      .eq("distribuidora_id", distId)
      .order("created_at", { ascending: false })
      .limit(200);
    return { cliente, pedidos: pedidos ?? [] };
  });

// -------- Horários de funcionamento --------
export const listHorarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const distId = await getDistId(context.supabase, context.userId);
    if (!distId) return [];
    const { data } = await context.supabase
      .from("horarios_funcionamento")
      .select("dia_semana,horario_abertura,horario_fechamento,is_fechado_o_dia_todo")
      .eq("distribuidora_id", distId)
      .order("dia_semana");
    return data ?? [];
  });

export const saveHorarios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    horarios: z.array(z.object({
      dia_semana: z.number().int().min(0).max(6),
      horario_abertura: z.string().nullable(),
      horario_fechamento: z.string().nullable(),
      is_fechado_o_dia_todo: z.boolean(),
    })).length(7),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const distId = await getDistId(context.supabase, context.userId);
    if (!distId) throw new Error("Distribuidora não encontrada");
    const rows = data.horarios.map(h => ({
      distribuidora_id: distId,
      dia_semana: h.dia_semana,
      horario_abertura: h.is_fechado_o_dia_todo ? null : (h.horario_abertura || "08:00"),
      horario_fechamento: h.is_fechado_o_dia_todo ? null : (h.horario_fechamento || "18:00"),
      is_fechado_o_dia_todo: h.is_fechado_o_dia_todo,
    }));
    const { error } = await context.supabase
      .from("horarios_funcionamento")
      .upsert(rows, { onConflict: "distribuidora_id,dia_semana" });
    if (error) throw error;
    return { ok: true };
  });

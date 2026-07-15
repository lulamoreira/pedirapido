import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { generatePixCode } from "@/lib/pix";

const schema = z.object({
  distribuidora_id: z.string().uuid(),
  cliente: z.object({
    nome: z.string().min(1).max(80),
    telefone: z.string().min(8).max(20),
    endereco: z.string().max(200).optional(),
  }),
  itens: z.array(z.object({
    produto_id: z.string().uuid(),
    quantidade: z.number().int().min(1).max(50),
  })).min(1).max(20),
  taxa_entrega: z.number().min(0).max(200).optional().default(0),
});

export const Route = createFileRoute("/api/public/webhook/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const input = schema.parse(body);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Distribuidora + limite plano free
          const { data: dist } = await supabaseAdmin
            .from("distribuidoras").select("*").eq("id", input.distribuidora_id).maybeSingle();
          if (!dist) return json({ error: "Distribuidora não encontrada" }, 404);

          if (dist.plano === "free") {
            const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
            const { count } = await supabaseAdmin.from("pedidos").select("*", { count: "exact", head: true })
              .eq("distribuidora_id", dist.id).gte("created_at", start.toISOString());
            if ((count ?? 0) >= 50) return json({ error: "Limite do plano Free atingido (50 pedidos/mês)" }, 402);
          }

          // Upsert cliente
          const { data: existing } = await supabaseAdmin.from("clientes")
            .select("id").eq("distribuidora_id", dist.id).eq("telefone", input.cliente.telefone).maybeSingle();
          let clienteId = existing?.id;
          if (!clienteId) {
            const { data: novo, error } = await supabaseAdmin.from("clientes").insert({
              distribuidora_id: dist.id,
              nome: input.cliente.nome,
              telefone: input.cliente.telefone,
              endereco: input.cliente.endereco ?? null,
            }).select("id").single();
            if (error) return json({ error: error.message }, 400);
            clienteId = novo.id;
          } else if (input.cliente.endereco) {
            await supabaseAdmin.from("clientes").update({
              nome: input.cliente.nome, endereco: input.cliente.endereco,
            }).eq("id", clienteId);
          }

          // Produtos + subtotal
          const ids = input.itens.map(i => i.produto_id);
          const { data: produtos } = await supabaseAdmin.from("produtos")
            .select("id,nome,preco,estoque").in("id", ids).eq("distribuidora_id", dist.id);
          if (!produtos || produtos.length !== ids.length) return json({ error: "Produto inválido" }, 400);

          let subtotal = 0;
          const itensData = input.itens.map(it => {
            const prod = produtos.find(p => p.id === it.produto_id)!;
            const sub = Number(prod.preco) * it.quantidade;
            subtotal += sub;
            return { produto_id: prod.id, quantidade: it.quantidade, preco_unit: Number(prod.preco), subtotal: sub };
          });

          const taxa = input.taxa_entrega ?? 0;
          const total = subtotal + taxa;
          const codigoPix = generatePixCode({ chave: dist.email ?? "aquaflow@demo.com.br", nome: dist.nome, cidade: "SAO PAULO", valor: total });

          const { data: pedido, error: perr } = await supabaseAdmin.from("pedidos").insert({
            distribuidora_id: dist.id,
            cliente_id: clienteId,
            subtotal, taxa_entrega: taxa, total,
            status: "pendente",
            codigo_pix: codigoPix,
          }).select("id").single();
          if (perr) return json({ error: perr.message }, 400);

          await supabaseAdmin.from("pedido_itens").insert(
            itensData.map(i => ({ ...i, pedido_id: pedido.id })),
          );

          return json({
            ok: true,
            pedido_id: pedido.id,
            total,
            codigo_pix: codigoPix,
            mensagem: `Pedido recebido! 💧\nTotal: R$ ${total.toFixed(2)}\nPague via PIX (copia e cola) e aguarde confirmação.`,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Erro";
          return json({ error: msg }, 400);
        }
      },
      OPTIONS: async () => new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "content-type",
        },
      }),
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { X, Search, Plus, Minus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listProdutos, searchClienteByPhone, createManualPedido } from "@/lib/aquaflow.functions";
import { formatBRL } from "@/lib/format";

type Item = { produto_id: string; quantidade: number };

export function NovoPedidoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: produtos = [] } = useQuery({ queryKey: ["produtos"], queryFn: () => listProdutos(), enabled: open });

  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const [forma, setForma] = useState<"pix" | "cartao" | "dinheiro">("pix");
  const [obs, setObs] = useState("");

  const reset = () => { setTelefone(""); setNome(""); setEndereco(""); setItens([]); setForma("pix"); setObs(""); setClienteState("idle"); };

  const [clienteState, setClienteState] = useState<"idle" | "found" | "new">("idle");

  const buscar = useMutation({
    mutationFn: () => searchClienteByPhone({ data: { telefone } }),
    onSuccess: (c: any) => {
      if (c) { setNome(c.nome); setEndereco(c.endereco ?? ""); setClienteState("found"); toast.success("Cliente encontrado"); }
      else { setClienteState("new"); }
    },
  });

  const criar = useMutation({
    mutationFn: () => createManualPedido({ data: {
      cliente: { nome, telefone, endereco: endereco || undefined },
      itens: itens.filter(i => i.quantidade > 0),
      forma_pagamento: forma,
      observacoes: obs || undefined,
    } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      qc.invalidateQueries({ queryKey: ["produtos"] });
      toast.success("Pedido criado!");
      reset(); onClose();
      navigate({ to: "/pedidos/$id", params: { id: r.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) return null;

  const addItem = (id: string) => setItens(prev => {
    const ex = prev.find(i => i.produto_id === id);
    if (ex) return prev.map(i => i.produto_id === id ? { ...i, quantidade: i.quantidade + 1 } : i);
    return [...prev, { produto_id: id, quantidade: 1 }];
  });
  const setQt = (id: string, qt: number) => setItens(prev => qt <= 0 ? prev.filter(i => i.produto_id !== id) : prev.map(i => i.produto_id === id ? { ...i, quantidade: qt } : i));

  const subtotal = itens.reduce((s, it) => {
    const p: any = produtos.find((x: any) => x.id === it.produto_id);
    return s + (p ? Number(p.preco) * it.quantidade : 0);
  }, 0);

  const canSubmit = nome.trim().length > 0 && telefone.replace(/\D/g, "").length >= 8 && itens.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black">Novo pedido</h2>
            <p className="text-xs text-muted-foreground">Venda balcão · PDV</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {/* Cliente */}
        <section className="rounded-2xl bg-accent p-3">
          <div className="text-xs font-bold uppercase tracking-wider text-primary">Cliente</div>
          <div className="mt-2 flex gap-2">
            <input value={telefone} onChange={e => { setTelefone(e.target.value); setClienteState("idle"); }} placeholder="Telefone" className="input flex-1" />
            <button type="button" onClick={() => telefone && buscar.mutate()} className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
              {buscar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do cliente*" className="input mt-2" />
          <input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Endereço de entrega" className="input mt-2" />
          {clienteState === "new" && (
            <p className="mt-2 rounded-xl bg-primary/10 px-3 py-2 text-[11px] font-medium text-primary">
              ✨ Cliente novo. Será cadastrado automaticamente ao finalizar o pedido.
            </p>
          )}
          {clienteState === "found" && (
            <p className="mt-2 text-[11px] font-medium text-emerald-600">✓ Cliente já cadastrado — dados preenchidos.</p>
          )}
        </section>

        {/* Produtos */}
        <section className="mt-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Produtos</div>
          <ul className="mt-2 space-y-2">
            {(produtos as any[]).map((p) => {
              const it = itens.find(i => i.produto_id === p.id);
              return (
                <li key={p.id} className="flex items-center justify-between rounded-2xl bg-secondary/60 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{p.nome}</div>
                    <div className="text-xs text-muted-foreground">{formatBRL(Number(p.preco))} · estoque {p.estoque}</div>
                  </div>
                  {it ? (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setQt(p.id, it.quantidade - 1)} className="grid h-8 w-8 place-items-center rounded-full bg-card shadow-soft">
                        {it.quantidade === 1 ? <Trash2 className="h-4 w-4 text-destructive" /> : <Minus className="h-4 w-4" />}
                      </button>
                      <span className="w-6 text-center text-sm font-bold">{it.quantidade}</span>
                      <button type="button" onClick={() => setQt(p.id, it.quantidade + 1)} className="grid h-8 w-8 place-items-center rounded-full gradient-primary text-primary-foreground shadow-soft">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => addItem(p.id)} className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-soft">
                      Adicionar
                    </button>
                  )}
                </li>
              );
            })}
            {produtos.length === 0 && <li className="text-xs text-muted-foreground">Cadastre produtos no Estoque.</li>}
          </ul>
        </section>

        {/* Pagamento */}
        <section className="mt-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pagamento</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {([
              { v: "pix", l: "PIX" },
              { v: "cartao", l: "Cartão" },
              { v: "dinheiro", l: "Dinheiro" },
            ] as const).map(o => (
              <button key={o.v} type="button" onClick={() => setForma(o.v)}
                className={"rounded-2xl px-3 py-3 text-sm font-bold transition " + (forma === o.v ? "gradient-primary text-primary-foreground shadow-float" : "bg-secondary text-muted-foreground")}>
                {o.l}
              </button>
            ))}
          </div>
          <textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Observação (ex: troco para R$ 50)" rows={2} className="input mt-3 resize-none" />
        </section>

        {/* Total + submit */}
        <div className="sticky bottom-0 -mx-5 mt-4 border-t border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="text-lg font-black">{formatBRL(subtotal)}</span>
          </div>
          <button
            disabled={!canSubmit || criar.isPending}
            onClick={() => criar.mutate()}
            className="flex w-full items-center justify-center gap-2 rounded-full gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-float disabled:opacity-50"
          >
            {criar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {forma === "pix" ? "Gerar pedido + PIX" : "Registrar pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}

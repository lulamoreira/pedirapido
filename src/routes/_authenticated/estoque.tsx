import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listProdutos, upsertProduto, deleteProduto, getPlano } from "@/lib/aquaflow.functions";
import { formatBRL, formatVolume } from "@/lib/format";
import { ArrowLeft, Plus, Pencil, Trash2, AlertTriangle, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/estoque")({
  component: EstoquePage,
});

type Categoria = "agua" | "bebidas" | "descartaveis" | "petiscos" | "outros";
type Unidade = "L" | "ml";
type FormState = { id?: string; nome: string; preco: string; estoque: string; estoque_minimo: string; categoria: Categoria; volume_valor: string; volume_unidade: Unidade };
const empty: FormState = { nome: "", preco: "", estoque: "0", estoque_minimo: "5", categoria: "agua", volume_valor: "", volume_unidade: "L" };

const CATEGORIAS: { value: Categoria; label: string; emoji: string; onlyBusiness: boolean }[] = [
  { value: "agua", label: "Água", emoji: "💧", onlyBusiness: false },
  { value: "bebidas", label: "Bebidas Gerais", emoji: "🥤", onlyBusiness: true },
  { value: "descartaveis", label: "Descartáveis", emoji: "🥢", onlyBusiness: true },
  { value: "petiscos", label: "Petiscos / Salgadinhos", emoji: "🍿", onlyBusiness: true },
  { value: "outros", label: "Outros (Gelo, Carvão…)", emoji: "🧊", onlyBusiness: true },
];

function EstoquePage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<FormState | null>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ["produtos"], queryFn: () => listProdutos() });
  const { data: plano } = useQuery({ queryKey: ["plano"], queryFn: () => getPlano() });
  const isBusiness = plano?.distribuidora.plano === "business";

  const save = useMutation({
    mutationFn: (f: FormState) => upsertProduto({
      data: {
        id: f.id, nome: f.nome.trim(),
        preco: Number(f.preco), estoque: Number(f.estoque), estoque_minimo: Number(f.estoque_minimo),
        categoria: f.categoria,
      },
    }),
    onSuccess: () => { toast.success("Produto salvo!"); qc.invalidateQueries({ queryKey: ["produtos"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProduto({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["produtos"] }); },
  });

  const ativos = (data as any[]).filter((p) => p.ativo);

  return (
    <div className="p-4 pb-8">
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-soft">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-black">Estoque</h1>
        </div>
        <button onClick={() => setEditing(empty)} className="flex items-center gap-1 rounded-full gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-float">
          <Plus className="h-4 w-4" /> Novo
        </button>
      </div>

      {isLoading && <div className="mt-6 text-sm text-muted-foreground">Carregando…</div>}

      <div className="mt-4 space-y-2">
        {ativos.map((p) => {
          const baixo = p.estoque <= p.estoque_minimo;
          const cat = CATEGORIAS.find(c => c.value === (p.categoria ?? "agua"));
          return (
            <div key={p.id} className="card-float p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat?.emoji ?? "💧"}</span>
                    <div className="truncate text-sm font-bold">{p.nome}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{cat?.label} · {formatBRL(p.preco)}</div>
                  <div className={"mt-1 flex items-center gap-1 text-xs font-semibold " + (baixo ? "text-status-preparing" : "text-muted-foreground")}>
                    {baixo && <AlertTriangle className="h-3 w-3" />}
                    {p.estoque} un {baixo && "· Repor!"}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing({ id: p.id, nome: p.nome, preco: String(p.preco), estoque: String(p.estoque), estoque_minimo: String(p.estoque_minimo), categoria: (p.categoria ?? "agua") as Categoria })} className="grid h-9 w-9 place-items-center rounded-xl bg-secondary" aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => confirm("Remover produto?") && remove.mutate(p.id)} className="grid h-9 w-9 place-items-center rounded-xl bg-destructive/10 text-destructive" aria-label="Remover">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {!isLoading && ativos.length === 0 && (
          <div className="card-float p-8 text-center text-sm text-muted-foreground">Sem produtos ainda.</div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background p-5 shadow-float" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
            <h2 className="text-lg font-black">{editing.id ? "Editar produto" : "Novo produto"}</h2>

            <div className="mt-4 space-y-3">
              <Field label="Nome" value={editing.nome} onChange={(v) => setEditing({ ...editing, nome: v })} />

              {/* Categoria */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Categoria</span>
                  {!isBusiness && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-600">
                      <Lock className="h-3 w-3" /> Plano atual: {plano?.distribuidora.plano ?? "free"}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIAS.map((c) => {
                    const locked = c.onlyBusiness && !isBusiness;
                    const active = editing.categoria === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        disabled={locked}
                        onClick={() => setEditing({ ...editing, categoria: c.value })}
                        className={
                          "relative flex items-center gap-2 rounded-2xl border p-3 text-left text-xs font-bold transition " +
                          (locked
                            ? "cursor-not-allowed border-border bg-secondary/50 text-muted-foreground opacity-70"
                            : active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card hover:border-primary/40")
                        }
                      >
                        <span className="text-lg">{c.emoji}</span>
                        <span className="flex-1">{c.label}</span>
                        {locked && <Lock className="h-3.5 w-3.5 text-amber-500" />}
                      </button>
                    );
                  })}
                </div>
                {!isBusiness && (
                  <Link
                    to="/plano"
                    className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span className="flex-1"><strong>Disponível apenas no Plano Business.</strong> Faça o upgrade!</span>
                    <span className="rounded-full bg-amber-500 px-3 py-1 text-[10px] font-bold uppercase text-white">Ver planos</span>
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Preço (R$)" value={editing.preco} type="number" onChange={(v) => setEditing({ ...editing, preco: v })} />
                <Field label="Estoque" value={editing.estoque} type="number" onChange={(v) => setEditing({ ...editing, estoque: v })} />
              </div>
              <Field label="Alerta em (un)" value={editing.estoque_minimo} type="number" onChange={(v) => setEditing({ ...editing, estoque_minimo: v })} />
            </div>
            <button
              disabled={!editing.nome || !editing.preco || save.isPending}
              onClick={() => save.mutate(editing)}
              className="mt-5 w-full rounded-full gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-float disabled:opacity-60"
            >
              {save.isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

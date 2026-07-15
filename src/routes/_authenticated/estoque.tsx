import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listProdutos, upsertProduto, deleteProduto } from "@/lib/aquaflow.functions";
import { formatBRL } from "@/lib/format";
import { ArrowLeft, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/estoque")({
  component: EstoquePage,
});

type FormState = { id?: string; nome: string; preco: string; estoque: string; estoque_minimo: string };
const empty: FormState = { nome: "", preco: "", estoque: "0", estoque_minimo: "5" };

function EstoquePage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<FormState | null>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ["produtos"], queryFn: () => listProdutos() });

  const save = useMutation({
    mutationFn: (f: FormState) => upsertProduto({
      data: {
        id: f.id, nome: f.nome.trim(),
        preco: Number(f.preco), estoque: Number(f.estoque), estoque_minimo: Number(f.estoque_minimo),
      },
    }),
    onSuccess: () => { toast.success("Produto salvo!"); qc.invalidateQueries({ queryKey: ["produtos"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProduto({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["produtos"] }); },
  });

  const ativos = data.filter((p) => p.ativo);

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
          return (
            <div key={p.id} className="card-float p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{p.nome}</div>
                  <div className="text-xs text-muted-foreground">{formatBRL(p.preco)}</div>
                  <div className={"mt-1 flex items-center gap-1 text-xs font-semibold " + (baixo ? "text-status-preparing" : "text-muted-foreground")}>
                    {baixo && <AlertTriangle className="h-3 w-3" />}
                    {p.estoque} un {baixo && "· Repor!"}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing({ id: p.id, nome: p.nome, preco: String(p.preco), estoque: String(p.estoque), estoque_minimo: String(p.estoque_minimo) })} className="grid h-9 w-9 place-items-center rounded-xl bg-secondary" aria-label="Editar">
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
          <div className="w-full max-w-lg rounded-t-3xl bg-background p-5 shadow-float" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
            <h2 className="text-lg font-black">{editing.id ? "Editar produto" : "Novo produto"}</h2>
            <div className="mt-4 space-y-3">
              <Field label="Nome" value={editing.nome} onChange={(v) => setEditing({ ...editing, nome: v })} />
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
